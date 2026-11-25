// Stickerazo: el servidor de la comunidad (Cloudflare Worker + D1).
// Cuentas sin email (un @usuario y una llave que guarda el celular), packs publicados (los WebP y el ícono, revisados
// como los revisa WhatsApp), feed (Para vos, Nuevos, Siguiendo), me gusta, seguir, perfiles, buscar, tendencias,
// descargas, denunciar y bloquear (con 3 denuncias el pack se oculta hasta que se revise), moderación en /admin
// (secreto ADMIN_CLAVE), la página para compartir un pack (/p/ID) y las de privacidad y términos.
// Los archivos van en la base (D1) o, si está el balde R2 «MEDIA», ahí.
// Anda solo (su propio Worker) o adentro del de JXMod: stickerazoRutas(req, env, ctx, '/sz') atiende lo que empieza con /sz
// y usa sus tablas con «sz_» adelante, para no pisar las de JXMod (que también tiene «usuarios»).

// (todavía no está en las tiendas: el botón «Bajá Stickerazo» lleva a nuestra página, que tiene el APK y, cuando estén, las tiendas)
import { verificarGoogle, paginaGoogle, googleObligatorio, huellaGoogle, sha256 } from './google.js';
import { nubeRutas, borrarNube } from './nube.js';
import { clipsRutas, clipsAdmin, borrarClips, PAGINA_ADMIN_CLIPS, TABLAS_CLIPS } from './clips.js';
import { pagosRutas, paginaPremium, pagosAlBorrar, ESQUEMA_PAGOS, cuentaDelTicket, estadoPremium, pagosPrendidos, quitarPremium } from './pagos.js';
import { socialRutas, socialAdmin, socialAlBorrar, socialAlBloquear, ESQUEMA_SOCIAL, TABLAS_SOCIAL } from './social.js';
// (la nube de cada cuenta: en su propia base si está, SZ_NUBE; si no, en la de siempre)
const nubeDb = (env) => env.SZ_NUBE || env.DB;
const bajar = (origen) => `${origen}/#bajar`;
// ---- lo que sale del repo (GitHub): las actualizaciones de la app (web/), la página web (sitio/) y el APK (descargas/) ----
// Así la app y la página no dependen del nombre de la rama: si cambia, se cambia SZ_RAMA en Cloudflare y listo.
const REPO = 'https://raw.githubusercontent.com/Juniorspro/Ports/', RAMA = 'claude/ports-continuation-dm754a';
const TIPOS = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  svg: 'image/svg+xml', ico: 'image/x-icon', ttf: 'font/ttf', woff2: 'font/woff2', glb: 'model/gltf-binary', wasm: 'application/wasm',
  tflite: 'application/octet-stream', mp4: 'video/mp4', webm: 'video/webm', apk: 'application/vnd.android.package-archive' };
async function delRepo(env, ruta, descarga = false) {
  const no = (st) => new Response(st === 404 ? 'No está' : 'No se pudo traer. Probá de nuevo en un rato.', { status: st, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
  // (sólo nombres comunes: nada de «..», ni ocultos, ni lo de prueba que empieza con «_»)
  if (!/^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ruta) || ruta.includes('..')) return no(404);
  const tipo = TIPOS[ruta.split('.').pop().toLowerCase()]; if (!tipo) return no(404);
  // (las letras del editor no cambian: una semana; las listas y las páginas, un minuto; lo demás, 5)
  const corto = /(^|\/)(ota|app)\.json$|\.html$/.test(ruta), seg = corto ? 60 : /^fuentes\/.+\.(woff2|ttf|webp)$/.test(ruta) ? 604800 : 300;
  let r = null;
  try { r = await fetch(`${env.SZ_REPO || REPO}${env.SZ_RAMA || RAMA}/porteos/stickerazo/${ruta}`, { cf: { cacheTtl: seg, cacheEverything: true }, ...(descarga ? {} : { signal: AbortSignal.timeout(15000) }) }); } catch (e) { r = null; }
  if (!r || !r.ok) return no(r && r.status === 404 ? 404 : 502);
  const h = { 'Content-Type': tipo, 'Cache-Control': `public, max-age=${seg}`, 'X-Content-Type-Options': 'nosniff', ...CORS }, n = r.headers.get('Content-Length');
  if (n) h['Content-Length'] = n;
  if (descarga) h['Content-Disposition'] = 'attachment; filename="Stickerazo.apk"';
  return new Response(r.body, { status: 200, headers: h });
}
const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS usuarios (id TEXT PRIMARY KEY, nombre TEXT UNIQUE NOT NULL, clave TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', creado INTEGER NOT NULL, bloqueado INTEGER NOT NULL DEFAULT 0, seguidores INTEGER NOT NULL DEFAULT 0, siguiendo INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS packs (id TEXT PRIMARY KEY, autor TEXT NOT NULL, nombre TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '', busqueda TEXT NOT NULL DEFAULT '', animado INTEGER NOT NULL DEFAULT 0, archivos TEXT NOT NULL, bandeja TEXT NOT NULL, v INTEGER NOT NULL DEFAULT 1, creado INTEGER NOT NULL, likes INTEGER NOT NULL DEFAULT 0, descargas INTEGER NOT NULL DEFAULT 0, reportes INTEGER NOT NULL DEFAULT 0, oculto INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS packs_autor ON packs (autor, creado)`,
  `CREATE INDEX IF NOT EXISTS packs_creado ON packs (creado)`,
  `CREATE TABLE IF NOT EXISTS archivos (pack TEXT NOT NULL, nombre TEXT NOT NULL, tipo TEXT NOT NULL, datos BLOB, PRIMARY KEY (pack, nombre))`,
  `CREATE TABLE IF NOT EXISTS likes (usuario TEXT NOT NULL, pack TEXT NOT NULL, creado INTEGER NOT NULL, PRIMARY KEY (usuario, pack))`,
  `CREATE TABLE IF NOT EXISTS descargas (usuario TEXT NOT NULL, pack TEXT NOT NULL, PRIMARY KEY (usuario, pack))`,
  `CREATE TABLE IF NOT EXISTS sigue (usuario TEXT NOT NULL, sigue_a TEXT NOT NULL, creado INTEGER NOT NULL, PRIMARY KEY (usuario, sigue_a))`,
  `CREATE TABLE IF NOT EXISTS reportes (usuario TEXT NOT NULL, pack TEXT NOT NULL, motivo TEXT NOT NULL, creado INTEGER NOT NULL, PRIMARY KEY (usuario, pack))`,
  `CREATE TABLE IF NOT EXISTS bloqueos (usuario TEXT NOT NULL, bloqueado TEXT NOT NULL, PRIMARY KEY (usuario, bloqueado))`,
  `CREATE TABLE IF NOT EXISTS limites (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, hasta INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS evento (id TEXT PRIMARY KEY, datos TEXT NOT NULL, creado INTEGER NOT NULL)`,
  // (entrar con Google: la entrada que espera a la app —e = SHA256 del verificador— o el ticket para elegir el @)
  `CREATE TABLE IF NOT EXISTS entradas (e TEXT PRIMARY KEY, google TEXT NOT NULL, usuario TEXT, vence INTEGER NOT NULL)`,
  // (lo que llega por el formulario de contacto)
  `CREATE TABLE IF NOT EXISTS contacto (id TEXT PRIMARY KEY, motivo TEXT NOT NULL, texto TEXT NOT NULL, mail TEXT NOT NULL DEFAULT '', creado INTEGER NOT NULL)`,
  ...ESQUEMA_PAGOS,   // (Premium, compras y donaciones: servidor/pagos.js)
  ...ESQUEMA_SOCIAL,   // (publicaciones, amigos y chat: servidor/social.js)
];
// (columnas que llegaron después: si ya están, el ALTER falla y no pasa nada)
const COLUMNAS_NUEVAS = ['ALTER TABLE usuarios ADD COLUMN cancion TEXT', 'ALTER TABLE packs ADD COLUMN privado INTEGER NOT NULL DEFAULT 0', 'ALTER TABLE usuarios ADD COLUMN google TEXT',
  'CREATE UNIQUE INDEX IF NOT EXISTS i_usuarios_google ON usuarios(google)', 'ALTER TABLE usuarios ADD COLUMN premium_hasta INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE usuarios ADD COLUMN donador INTEGER NOT NULL DEFAULT 0'];
const TABLAS = 'usuarios|packs|archivos|likes|descargas|sigue|reportes|bloqueos|limites|evento|entradas|contacto|nube_packs|nube_archivos|premium|pagos|tickets_pago|ofertas|' + TABLAS_SOCIAL + '|' + TABLAS_CLIPS;
const RE_TABLA = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE|ALTER TABLE|TABLE IF NOT EXISTS|ON)\\s+(${TABLAS})\\b`, 'g'), RE_INDICE = /\bINDEX IF NOT EXISTS (\w+)/g;
export const conPrefijo = (sql, pre) => sql.replace(RE_TABLA, `$1 ${pre}$2`).replace(RE_INDICE, `INDEX IF NOT EXISTS ${pre}$1`);
// la base de JXMod, vista con las tablas de Stickerazo («sz_usuarios», «sz_packs»…)
function basePrefijada(db, pre) { return { prepare: (q) => db.prepare(conPrefijo(q, pre)), batch: (l) => db.batch(l), exec: (q) => db.exec(conPrefijo(q, pre)) }; }
let listo = null;
const preparar = (env) => (listo ||= env.DB.batch(ESQUEMA.map((s) => env.DB.prepare(s))).then(async () => { for (const q of COLUMNAS_NUEVAS) { try { await env.DB.prepare(q).run(); } catch (e) { /* ya estaba */ } } }).catch((e) => { listo = null; throw e; }));

// ---- ayudas ----
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin, X-Huella', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' };
const json = (d, st = 200) => new Response(JSON.stringify(d), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
const error = (msg, st = 400) => json({ error: msg }, st);
const html = (cuerpo, st = 200) => new Response(cuerpo, { status: st, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
const nuevoId = (n = 10) => { const a = crypto.getRandomValues(new Uint8Array(n)), c = 'abcdefghijkmnopqrstuvwxyz23456789'; return [...a].map((x) => c[x % c.length]).join(''); };
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha(texto) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))); return [...d].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const bytesDe = (d) => (d == null ? null : d instanceof ArrayBuffer ? new Uint8Array(d) : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : Uint8Array.from(d));

// ---- lo que no se puede (odio, sexual) en ningún texto, y los nombres que no se pueden usar ----
// (las cortas, como palabra entera: «controlo» no es «trolo»; las largas, también con las letras pegadas: «n u d e s»)
const PROHIBIDAS_PALABRA = ['nazi', 'nazis', 'hitler', 'kkk', 'porno', 'porn', 'xxx', 'nudes', 'trolo', 'trolos', 'sidoso', 'mogolico', 'mogolica', 'desnuda', 'desnudas', 'desnudo'];
const PROHIBIDAS_JUNTAS = ['nudes', 'porno', 'pedofil', 'violacion', 'negrodemierda', 'judiodemierda', 'hitler'];
const RESERVADOS = ['admin', 'administrador', 'stickerazo', 'soporte', 'moderador', 'oficial', 'whatsapp', 'google', 'sistema'];
const INSULTOS_NOMBRE = ['puto', 'puta', 'trolo', 'pija', 'verga', 'concha', 'mierda', 'pajero', 'pelotudo', 'sorete', 'culiado', 'forro'];
const plano = (s) => normal(s).replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4|@/g, 'a').replace(/5|\$/g, 's').replace(/7/g, 't');
export const textoProhibido = (s) => { const p = plano(s), junto = p.replace(/[^a-zñ]/g, ''); return p.split(/[^a-zñ]+/).some((w) => PROHIBIDAS_PALABRA.includes(w)) || PROHIBIDAS_JUNTAS.some((x) => junto.includes(x)); };
export function nombreInvalido(n) {
  if (!/^[a-z0-9_.]{3,20}$/.test(n) || /^[._]|[._]$|\.\./.test(n)) return 'Usá de 3 a 20 letras minúsculas, números, punto o guion bajo';
  const j = plano(n).replace(/[^a-z]/g, '');
  if (RESERVADOS.some((x) => j.startsWith(x)) || INSULTOS_NOMBRE.some((x) => j.includes(x)) || textoProhibido(n)) return 'Ese nombre no se puede usar';
  return null;
}

// ---- los archivos: revisados como los revisa WhatsApp ----
export function infoWebP(b) {
  const id = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]), u24 = (o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  if (b.length < 30 || id(0) !== 'RIFF' || id(8) !== 'WEBP') return null;
  const c = id(12);
  if (c === 'VP8X') return { animado: !!(b[20] & 0x02), w: u24(24) + 1, h: u24(27) + 1 };
  if (c === 'VP8 ') return { animado: false, w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
  if (c === 'VP8L') { const x = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { animado: false, w: (x & 0x3fff) + 1, h: ((x >> 14) & 0x3fff) + 1 }; }
  return null;
}
export function infoPNG(b) {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  return { w: u32(16), h: u32(20) };
}
async function guardarArchivo(env, pack, nombre, tipo, datos) {
  if (env.MEDIA) { await env.MEDIA.put(`${pack}/${nombre}`, datos, { httpMetadata: { contentType: tipo } }); return env.DB.prepare('INSERT OR REPLACE INTO archivos (pack, nombre, tipo, datos) VALUES (?, ?, ?, NULL)').bind(pack, nombre, tipo); }
  return env.DB.prepare('INSERT OR REPLACE INTO archivos (pack, nombre, tipo, datos) VALUES (?, ?, ?, ?)').bind(pack, nombre, tipo, datos);
}
async function borrarArchivos(env, pack) {
  if (env.MEDIA) { const { results } = await env.DB.prepare('SELECT nombre FROM archivos WHERE pack = ?').bind(pack).all(); for (const r of results) await env.MEDIA.delete(`${pack}/${r.nombre}`); }
  await env.DB.prepare('DELETE FROM archivos WHERE pack = ?').bind(pack).run();
}

// ---- borrar una cuenta y todo lo suyo (desde la app, o desde la web con Google) ----
async function borrarCuenta(env, idCuenta) {
  const yo = { id: idCuenta };
    const { results } = await env.DB.prepare('SELECT id FROM packs WHERE autor = ?').bind(yo.id).all();
    for (const p of results) await borrarPack(env, p.id);
    await env.DB.prepare('DELETE FROM archivos WHERE pack = ?').bind('u_' + yo.id).run();   // (su foto y su portada)
    const sig = await env.DB.prepare('SELECT sigue_a FROM sigue WHERE usuario = ?').bind(yo.id).all(), seg = await env.DB.prepare('SELECT usuario FROM sigue WHERE sigue_a = ?').bind(yo.id).all();
    const ops = [...sig.results.map((x) => env.DB.prepare('UPDATE usuarios SET seguidores = MAX(0, seguidores - 1) WHERE id = ?').bind(x.sigue_a)), ...seg.results.map((x) => env.DB.prepare('UPDATE usuarios SET siguiendo = MAX(0, siguiendo - 1) WHERE id = ?').bind(x.usuario))];
    const { results: mg } = await env.DB.prepare('SELECT pack FROM likes WHERE usuario = ?').bind(yo.id).all();
    for (const x of mg) ops.push(env.DB.prepare('UPDATE packs SET likes = MAX(0, likes - 1) WHERE id = ?').bind(x.pack));
    for (const s of ['DELETE FROM likes WHERE usuario = ?', 'DELETE FROM sigue WHERE usuario = ? OR sigue_a = ?', 'DELETE FROM reportes WHERE usuario = ?', 'DELETE FROM bloqueos WHERE usuario = ? OR bloqueado = ?', 'DELETE FROM descargas WHERE usuario = ?', 'DELETE FROM usuarios WHERE id = ?'])
      ops.push(env.DB.prepare(s).bind(...Array((s.match(/\?/g) || []).length).fill(yo.id)));
    await env.DB.batch(ops);
  await env.DB.prepare('DELETE FROM entradas WHERE usuario = ?').bind(idCuenta).run();
  await borrarNube(nubeDb(env), idCuenta);   // (y lo que tenía guardado en su cuenta)
  await borrarClips(nubeDb(env), idCuenta);   // (y sus clips con sonido: clips.js)
  await pagosAlBorrar(env, env.DB, idCuenta);   // (si pagaba Premium por mes o por año, se da de baja)
  await socialAlBorrar(env.DB, idCuenta, (pack) => borrarArchivos(env, pack));   // (sus publicaciones, amigos y mensajes)
}

// ---- límites (para que nadie llene todo de una) ----
async function limite(env, clave, max, segundos) {
  const ahora = Date.now(), r = await env.DB.prepare('SELECT n, hasta FROM limites WHERE clave = ?').bind(clave).first();
  if (!r || r.hasta < ahora) {
    if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM limites WHERE hasta < ?').bind(ahora).run();   // (los vencidos)
    await env.DB.prepare('INSERT OR REPLACE INTO limites (clave, n, hasta) VALUES (?, 1, ?)').bind(clave, ahora + segundos * 1000).run(); return true;
  }
  if (r.n >= max) return false;
  await env.DB.prepare('UPDATE limites SET n = n + 1 WHERE clave = ?').bind(clave).run();
  return true;
}

// ---- la cuenta: «Authorization: Bearer <id>.<llave>» ----
async function quien(req, env) {
  const m = /^Bearer ([a-z0-9]{10})\.([A-Za-z0-9_-]{20,})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const u = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(m[1]).first();
  if (!u || u.clave !== (await sha(m[2])) || u.bloqueado) return null;
  return u;
}
// (el avatar: emoji, color y portada de las de la app; y si subió una foto o una portada propia, su dirección —relativa
// al servidor— con la versión, así la caché se renueva cuando la cambia)
const leerAvatar = (u) => { try { return JSON.parse(u.avatar || '{}') || {}; } catch (e) { return {}; } };
const avatarDe = (u) => { const a = leerAvatar(u); return { e: a.e || 'p:cool', c: a.c || '#ff3e8a', p: Number.isInteger(a.p) ? a.p : 0, f: a.f && u.id ? `u/${u.id}/foto?v=${a.f}` : null, b: a.b && u.id ? `u/${u.id}/portada?v=${a.b}` : null }; };
// (la canción del perfil, como en Instagram: un video de YouTube que suena al tocarla en el perfil)
const cancionDe = (u) => { try { const c = JSON.parse(u.cancion || 'null'); return c && /^[\w-]{11}$/.test(c.id) ? { id: c.id, t: String(c.t || '').slice(0, 100), c: String(c.c || '').slice(0, 60) } : null; } catch (e) { return null; } };
const publico = (u) => ({ id: u.id, nombre: u.nombre, bio: u.bio, avatar: avatarDe(u), seguidores: u.seguidores, siguiendo: u.siguiendo, creado: u.creado, premium: (u.premium_hasta || 0) > Date.now(), donador: !!u.donador, cancion: cancionDe(u) });

// ---- un pack, para mostrar ----
function resumen(p) {
  const a = JSON.parse(p.archivos);
  return {
    id: p.id, nombre: p.nombre, tags: p.tags ? p.tags.split(' ') : [], animado: !!p.animado, n: a.length, muestra: a.slice(0, 6).map((x) => x.archivo), bandeja: p.bandeja, v: p.v,
    likes: p.likes, descargas: p.descargas, creado: p.creado, privado: !!p.privado, autor: { id: p.autor, nombre: p.a_nombre, avatar: avatarDe({ id: p.autor, avatar: p.a_avatar }), premium: (p.a_premium || 0) > Date.now() },
  };
}
const TODOS_DE = 'SELECT p.*, u.nombre AS a_nombre, u.avatar AS a_avatar, u.premium_hasta AS a_premium FROM packs p JOIN usuarios u ON u.id = p.autor WHERE p.oculto = 0 AND u.bloqueado = 0';
// (lo público: sin lo que su dueño ocultó)
const CON_AUTOR = TODOS_DE + ' AND p.privado = 0';
async function marcarLikes(env, yo, packs) {
  if (!yo || !packs.length) return packs;
  const { results } = await env.DB.prepare(`SELECT pack FROM likes WHERE usuario = ? AND pack IN (${packs.map(() => '?').join(',')})`).bind(yo.id, ...packs.map((p) => p.id)).all();
  const s = new Set(results.map((r) => r.pack)); for (const p of packs) p.yaLike = s.has(p.id);
  return packs;
}
const sinBloqueados = (yo) => (yo ? ' AND p.autor NOT IN (SELECT bloqueado FROM bloqueos WHERE usuario = ?)' : '');

// ================= rutas =================
export default { fetch: (req, env, ctx) => manejar(req, env, ctx, '') };
// (adentro del Worker de JXMod)
export function stickerazoRutas(req, env, ctx, base) { return manejar(req, { ...env, DB: basePrefijada(env.DB, 'sz_') }, ctx, base); }
async function manejar(req, env, ctx, base) {
  {
    // (si lo pide la dirección propia —stickerazo.pages.dev, por su proxy—, los enlaces de las páginas van por ahí)
    const sitio = req.headers.get('X-Sitio') || '', propia = /^https:\/\/([a-z0-9-]+\.)?stickerazo\.pages\.dev$/.test(sitio);
    const u = new URL(req.url), ruta = u.pathname.slice(base.length) || '/', metodo = req.method, origen = propia ? sitio : u.origin + base;
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      // la página web (sitio/index.html del repo; si GitHub no contesta, una cortita)
      if (base && u.pathname === base) return Response.redirect(u.origin + base + '/' + u.search, 302);
      if (ruta === '/' || ruta === '') {
        const r = await delRepo(env, 'sitio/index.html');
        return r.ok ? r : html(pagina('Stickerazo', '<h1>Stickerazo</h1><p>Hacé stickers para WhatsApp con tus fotos y compartilos con la comunidad.</p><a class="b" href="descargar">Bajar para Android</a>'));
      }
      if (ruta.startsWith('/a/')) return delRepo(env, 'sitio/a/' + ruta.slice(3));
      // (la revisión de los clips con sonido: clips.js)
      if (ruta === '/admin/clips') return new Response(PAGINA_ADMIN_CLIPS, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
      // las actualizaciones de la app (lo mismo que web/ en el repo) y el APK de ahora con sus datos
      if (ruta.startsWith('/web/')) return delRepo(env, 'web/' + ruta.slice(5));
      // las «más letras» del editor (fuentes/ del repo: no van en la app, se bajan cuando alguien elige una)
      if (ruta.startsWith('/fuentes/')) return delRepo(env, 'fuentes/' + ruta.slice(9));
      if (ruta === '/app.json') return delRepo(env, 'descargas/app.json');
      if (ruta === '/descargar' || ruta === '/Stickerazo.apk') return delRepo(env, 'descargas/Stickerazo.apk', true);
      // las páginas legales y el contacto (sitio/*.html del repo; si GitHub no contesta, las cortitas de acá)
      const LEGALES = { '/privacidad': ['Privacidad', PRIVACIDAD], '/terminos': ['Términos', TERMINOS], '/borrar-cuenta': ['Borrar tu cuenta', BORRAR], '/contacto': ['Contacto', CONTACTO] };
      if (LEGALES[ruta]) { const r = await delRepo(env, 'sitio' + ruta + '.html'); return r.ok ? r : html(pagina(LEGALES[ruta][0] + ' · Stickerazo', LEGALES[ruta][1])); }
      // entrar con Google (la abre la app en el navegador) y borrar la cuenta desde la web, con Google
      const servidor = u.origin + base;
      if (ruta === '/entrar' || ruta === '/borrar') {
        if (!googleObligatorio(env)) return html(pagina('Stickerazo', '<h1>Entrar con Google todavía no está prendido</h1>'), 503);
        const e = u.searchParams.get('e') || '';
        if (ruta === '/entrar' && !/^[a-f0-9]{64}$/.test(e)) return html(pagina('Stickerazo', '<h1>Abrí este enlace desde la app</h1><p class="p">Tocá «Entrar con Google» en Stickerazo.</p>'), 400);
        return paginaGoogle(env, { modo: ruta === '/entrar' ? 'entrar' : 'borrar', e: ruta === '/entrar' ? e : '', apiBase: servidor + '/api', origen: servidor });
      }
      await preparar(env);
      if (ruta.startsWith('/m/')) return media(req, env, ctx, ruta);
      if (ruta.startsWith('/u/')) return imagenPerfil(req, env, ctx, ruta);
      if (ruta.startsWith('/s/') || ruta.startsWith('/c/')) return mediaSocial(req, env, ctx, ruta);
      if (ruta.startsWith('/p/')) return compartir(env, ruta.slice(3), origen);
      // Premium y donaciones: la página con los botones de PayPal (la abre la app en el navegador, con un ticket)
      if (ruta === '/premium') {
        if (!pagosPrendidos(env)) return html(pagina('Stickerazo Premium', '<h1>Premium llega muy pronto</h1><p class="p">Todavía no se puede pagar.</p>'), 503);
        const t = u.searchParams.get('t') || '', quienPaga = await cuentaDelTicket(env.DB, t);
        const fila = quienPaga && (await env.DB.prepare('SELECT id, nombre FROM usuarios WHERE id = ?').bind(quienPaga).first());
        if (!fila) return html(pagina('Stickerazo Premium', '<h1>El enlace venció</h1><p class="p">Volvé a Stickerazo y tocá «Premium» de nuevo.</p>'), 401);
        return paginaPremium(env, { t, usuario: fila, est: await estadoPremium(env, env.DB, fila.id), apiBase: servidor + '/api', origen: servidor });
      }
      if (ruta === '/admin') return html(paginaAdmin(base));
      if (!ruta.startsWith('/api/')) return html(pagina('No está', '<h1>No está</h1>'), 404);
      return await api(req, env, u, ruta.slice(5), metodo, servidor);
    } catch (e) {
      console.error(e);
      return error('Se nos complicó algo. Probá de nuevo en un rato.', 500);
    }
  }
}

async function api(req, env, u, r, metodo, servidor) {
  const yo = await quien(req, env), cuerpo = async () => { try { return await req.json(); } catch (e) { return {}; } };
  // (la conexión sólo para los límites: se guarda su huella, no la IP, y se borra cuando vence)
  const ip = (await sha('sz-limite:' + (req.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 24);
  let m;
  // ---- entrar con Google (google.js) ----
  if (r === 'config' && metodo === 'GET') return json({ google: googleObligatorio(env), entrar: servidor + '/entrar' });
  // (con Google prendido, sin cuenta de Google no se escribe nada: sólo vincularla o borrar la cuenta)
  if (googleObligatorio(env) && yo && !yo.google && metodo !== 'GET' && r !== 'google/listo' && !(r === 'yo' && metodo === 'DELETE'))
    return json({ error: 'Conectá tu cuenta de Google para seguir', google: true }, 403);
  if (r === 'google' && metodo === 'POST') {
    // (la página del navegador: el ID token de Google con e como nonce → la entrada espera a la app 10 minutos)
    if (!googleObligatorio(env)) return error('Entrar con Google no está prendido', 503);
    if (!(await limite(env, 'google:' + ip, 30, 3600))) return error('Probá en un rato', 429);
    const { credencial, e } = await cuerpo();
    if (!/^[a-f0-9]{64}$/.test(String(e || ''))) return error('Abrí la página desde la app');
    const g = await verificarGoogle(credencial, env, { nonce: e });
    if (!g) return error('Google no confirmó tu cuenta. Probá de nuevo desde la app.', 401);
    const h = await huellaGoogle(g.sub), us = await env.DB.prepare('SELECT id, nombre, bloqueado FROM usuarios WHERE google = ?').bind(h).first();
    if (us && us.bloqueado) return error('Esta cuenta está bloqueada', 403);
    await env.DB.prepare('INSERT OR REPLACE INTO entradas (e, google, usuario, vence) VALUES (?, ?, ?, ?)').bind(e, h, us ? us.id : null, Date.now() + 600e3).run();
    if (Math.random() < 0.1) await env.DB.prepare('DELETE FROM entradas WHERE vence < ?').bind(Date.now()).run();
    return json({ ok: true, nombre: us ? us.nombre : null });
  }
  if (r === 'google/listo' && metodo === 'POST') {
    // (la app, con su verificador: se lleva la sesión una sola vez; si la cuenta de Google es nueva, un ticket para el @)
    const { v } = await cuerpo();
    if (!/^[a-f0-9]{64}$/.test(String(v || ''))) return error('Falta el verificador');
    const e = await sha256(v), ent = await env.DB.prepare('SELECT * FROM entradas WHERE e = ? AND vence > ?').bind(e, Date.now()).first();
    if (!ent) return json({ esperando: true });
    await env.DB.prepare('DELETE FROM entradas WHERE e = ?').bind(e).run();
    let id = ent.usuario;
    // (la cuenta vieja de esta app, sólo con @: se le vincula esta cuenta de Google)
    if (!id && yo && !yo.google) { await env.DB.prepare('UPDATE usuarios SET google = ? WHERE id = ?').bind(ent.google, yo.id).run(); id = yo.id; }
    if (!id) {
      const ticket = b64u(crypto.getRandomValues(new Uint8Array(24)));
      await env.DB.prepare('INSERT INTO entradas (e, google, usuario, vence) VALUES (?, ?, NULL, ?)').bind('t:' + (await sha256(ticket)), ent.google, Date.now() + 1800e3).run();
      return json({ nuevo: true, ticket });
    }
    const llave = b64u(crypto.getRandomValues(new Uint8Array(24)));
    await env.DB.prepare('UPDATE usuarios SET clave = ? WHERE id = ?').bind(await sha(llave), id).run();
    return json({ token: `${id}.${llave}`, usuario: { ...publico(await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first()), conGoogle: true } });
  }
  if (r === 'google/borrar' && metodo === 'POST') {
    // (borrar la cuenta desde la web: con un ID token de Google de los últimos 10 minutos)
    if (!googleObligatorio(env)) return error('Entrar con Google no está prendido', 503);
    if (!(await limite(env, 'gborrar:' + ip, 10, 3600))) return error('Probá en un rato', 429);
    const { credencial } = await cuerpo(), g = await verificarGoogle(credencial, env, { recien: 600 });
    if (!g) return error('Google no confirmó tu cuenta. Probá de nuevo.', 401);
    const us = await env.DB.prepare('SELECT id, nombre FROM usuarios WHERE google = ?').bind(await huellaGoogle(g.sub)).first();
    if (!us) return error('Esa cuenta de Google no tiene una cuenta de Stickerazo', 404);
    await borrarCuenta(env, us.id);
    return json({ ok: true, nombre: us.nombre });
  }
  // ---- tus packs guardados en tu cuenta (nube.js) ----
  { const rn = await nubeRutas(req, nubeDb(env), yo, r, metodo, { json, error, limite: (k, n, s) => limite(env, k, n, s) }); if (rn) return rn; }
  // ---- clips con sonido para el buscador de stickers de WhatsApp (clips.js) ----
  { const rc = await clipsRutas(req, nubeDb(env), yo, r, metodo, { json, error, limite: (k, n, s) => limite(env, k, n, s), cuerpo, textoProhibido }); if (rc) return rc; }
  { const rp = await pagosRutas(req, env, env.DB, yo, r, metodo, servidor, { json, error, limite: (k, n, s) => limite(env, k, n, s), cuerpo }); if (rp) return rp; }
  // ---- publicaciones, amigos y chat (social.js) ----
  { const rs = await socialRutas(req, env, env.DB, yo, r, metodo, { json, error, limite: (k, n, s) => limite(env, k, n, s), cuerpo, textoProhibido, publico, infoWebP, nuevoId,
      guardarArchivo: (pk, n, t, d) => guardarArchivo(env, pk, n, t, d), borrarArchivos: (pk) => borrarArchivos(env, pk) }); if (rs) return rs; }
  // ---- contacto (el formulario de la página) ----
  if (r === 'contacto' && metodo === 'POST') {
    const d = await cuerpo(), motivo = ['consulta', 'privacidad', 'borrar', 'derechos', 'denuncia', 'arrepentimiento', 'baja', 'pagos', 'otro'].includes(d.motivo) ? d.motivo : 'otro';
    const texto = String(d.texto || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 3000), mail = String(d.mail || '').trim().slice(0, 120);
    if (texto.length < 10) return error('Contanos un poco más (al menos 10 letras)');
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return error('Ese mail no parece bien escrito');
    if (!(await limite(env, 'contacto:' + ip, 5, 86400))) return error('Ya mandaste varios mensajes hoy. Probá mañana.', 429);
    await env.DB.prepare('INSERT INTO contacto (id, motivo, texto, mail, creado) VALUES (?, ?, ?, ?, ?)').bind(nuevoId(), motivo, texto, mail, Date.now()).run();
    // (los mensajes se guardan un año como mucho)
    if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM contacto WHERE creado < ?').bind(Date.now() - 365 * 86400e3).run();
    return json({ ok: true }, 201);
  }
  // ---- cuenta ----
  if (r === 'registro' && metodo === 'POST') {
    const { nombre: n0, ticket } = await cuerpo(), nombre = String(n0 || '').trim().toLowerCase().replace(/^@/, ''), mal = nombreInvalido(nombre);
    // (con Google prendido, la cuenta nueva sale sólo del ticket que dio «entrar con Google»)
    let tk = null;
    if (googleObligatorio(env)) {
      tk = /^[A-Za-z0-9_-]{20,64}$/.test(String(ticket || '')) ? await env.DB.prepare('SELECT * FROM entradas WHERE e = ? AND vence > ?').bind('t:' + (await sha256(ticket)), Date.now()).first() : null;
      if (!tk) return json({ error: 'Entrá con tu cuenta de Google', google: true }, 401);
    }
    if (mal) return error(mal);
    if (!(await limite(env, 'reg:' + ip, 5, 86400))) return error('Hiciste muchas cuentas hoy. Probá mañana.', 429);
    if (await env.DB.prepare('SELECT 1 FROM usuarios WHERE nombre = ?').bind(nombre).first()) return error('Ese @ ya lo tiene alguien', 409);
    const id = nuevoId(), llave = b64u(crypto.getRandomValues(new Uint8Array(24))), avatar = JSON.stringify({ e: ['p:cool', 'p:mate', 'p:risa', 'p:guino', 'p:ojitos', 'p:amor', 'p:sol', 'p:estrella'][Math.floor(Math.random() * 8)], c: ['#ff3e8a', '#ffd23f', '#3ec7ff', '#4cd964', '#ff7a1a', '#9b5cff'][Math.floor(Math.random() * 6)] });
    await env.DB.prepare('INSERT INTO usuarios (id, nombre, clave, avatar, creado, google) VALUES (?, ?, ?, ?, ?, ?)').bind(id, nombre, await sha(llave), avatar, Date.now(), tk ? tk.google : null).run();
    if (tk) await env.DB.prepare('DELETE FROM entradas WHERE e = ?').bind(tk.e).run();
    const usr = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first();
    return json({ token: `${id}.${llave}`, usuario: { ...publico(usr), conGoogle: !!usr.google } }, 201);
  }
  if (r === 'yo' && metodo === 'GET') { if (!yo) return error('Entrá con tu cuenta', 401); return json({ usuario: { ...publico(yo), conGoogle: !!yo.google }, google: googleObligatorio(env) }); }
  if (r === 'yo' && metodo === 'PATCH') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const d = await cuerpo(), sets = [], vals = [];
    if (d.cancion !== undefined) { const c = d.cancion; if (c === null) { sets.push('cancion = ?'); vals.push(null); } else if (c && /^[\w-]{11}$/.test(c.id)) { const t = String(c.t || '').trim().slice(0, 100), ca = String(c.c || '').trim().slice(0, 60); if (textoProhibido(t)) return error('Esa canción no se puede'); sets.push('cancion = ?'); vals.push(JSON.stringify({ id: c.id, t, c: ca })); } else return error('Mal armado'); }
    if (d.bio !== undefined) { const bio = String(d.bio).trim().slice(0, 120); if (textoProhibido(bio)) return error('Esa bio no se puede'); sets.push('bio = ?'); vals.push(bio); }
    if (d.avatar) { const e = String(d.avatar.e || '').slice(0, 16), c = /^#[0-9a-f]{6}$/i.test(d.avatar.c || '') ? d.avatar.c : '#ff3e8a'; const pp = Number.isInteger(d.avatar.p) && d.avatar.p >= 0 && d.avatar.p < 12 ? d.avatar.p : 0; sets.push('avatar = ?'); const ant = leerAvatar(yo); vals.push(JSON.stringify({ e: e || 'p:cool', c, p: pp, f: d.avatar.quitarFoto ? 0 : ant.f || 0, b: d.avatar.quitarPortada ? 0 : ant.b || 0 })); if (d.avatar.quitarFoto) await env.DB.prepare('DELETE FROM archivos WHERE pack = ? AND nombre = ?').bind('u_' + yo.id, 'foto').run(); if (d.avatar.quitarPortada) await env.DB.prepare('DELETE FROM archivos WHERE pack = ? AND nombre = ?').bind('u_' + yo.id, 'portada').run();; }
    if (d.nombre !== undefined && d.nombre !== yo.nombre) {
      const n = String(d.nombre).trim().toLowerCase().replace(/^@/, ''), mal = nombreInvalido(n); if (mal) return error(mal);
      if (!(await limite(env, 'nom:' + yo.id, 3, 86400))) return error('Ya te cambiaste el nombre muchas veces hoy', 429);
      if (await env.DB.prepare('SELECT 1 FROM usuarios WHERE nombre = ?').bind(n).first()) return error('Ese @ ya lo tiene alguien', 409);
      sets.push('nombre = ?'); vals.push(n);
    }
    if (sets.length) await env.DB.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, yo.id).run();
    return json({ usuario: publico(await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(yo.id).first()) });
  }
  // ---- mi foto de perfil o mi portada (una imagen mía: WebP o PNG, chica) ----
  if ((m = /^yo\/(foto|portada)$/.exec(r)) && metodo === 'PUT') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    if (!(await limite(env, 'img:' + yo.id, 20, 86400))) return error('Cambiaste mucho la foto hoy. Probá mañana.', 429);
    const que = m[1], b = new Uint8Array(await req.arrayBuffer()), max = que === 'foto' ? 200 * 1024 : 400 * 1024;
    if (!b.length || b.length > max) return error(que === 'foto' ? 'La foto pesa demasiado' : 'La portada pesa demasiado');
    const inf = infoWebP(b) || infoPNG(b);
    if (!inf) return error('Tiene que ser una imagen WebP o PNG');
    const [w, h] = [inf.w || inf.ancho, inf.h || inf.alto];
    if (que === 'foto' ? (w > 1024 || h > 1024) : (w > 1600 || h > 900)) return error('La imagen es muy grande');
    await env.DB.prepare('INSERT OR REPLACE INTO archivos (pack, nombre, tipo, datos) VALUES (?, ?, ?, ?)').bind('u_' + yo.id, que, infoWebP(b) ? 'image/webp' : 'image/png', b).run();
    const ant = leerAvatar(yo); ant[que === 'foto' ? 'f' : 'b'] = Date.now();
    await env.DB.prepare('UPDATE usuarios SET avatar = ? WHERE id = ?').bind(JSON.stringify(ant), yo.id).run();
    return json({ usuario: publico(await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(yo.id).first()) });
  }
  if (r === 'yo' && metodo === 'DELETE') {
    // (borrar la cuenta y todo lo suyo, como pide Google Play)
    if (!yo) return error('Entrá con tu cuenta', 401);
    await borrarCuenta(env, yo.id);
    return json({ ok: true });
  }
  // ---- feed, tendencias, buscar ----
  if (r === 'feed' && metodo === 'GET') {
    const modo = u.searchParams.get('modo') || 'para-vos', desde = Math.max(0, +u.searchParams.get('desde') || 0), N = 20;
    let filas;
    if (modo === 'siguiendo') {
      if (!yo) return json({ packs: [], sigue: null, necesitaCuenta: true });
      filas = (await env.DB.prepare(`${CON_AUTOR} AND p.autor IN (SELECT sigue_a FROM sigue WHERE usuario = ?) ORDER BY p.creado DESC LIMIT ? OFFSET ?`).bind(yo.id, N + 1, desde).all()).results;
    } else if (modo === 'nuevos') {
      filas = (await env.DB.prepare(`${CON_AUTOR}${sinBloqueados(yo)} ORDER BY p.creado DESC LIMIT ? OFFSET ?`).bind(...(yo ? [yo.id] : []), N + 1, desde).all()).results;
    } else {
      // (Para vos: lo que más gusta y se baja, pesado por lo nuevo que es)
      const todos = (await env.DB.prepare(`${CON_AUTOR}${sinBloqueados(yo)} ORDER BY p.creado DESC LIMIT 500`).bind(...(yo ? [yo.id] : [])).all()).results, ahora = Date.now();
      const punt = (p) => (p.likes * 3 + p.descargas * 2 + 2) / Math.pow((ahora - p.creado) / 3600000 + 3, 1.25);
      filas = todos.sort((a, b) => punt(b) - punt(a)).slice(desde, desde + N + 1);
    }
    let packs = await marcarLikes(env, yo, filas.slice(0, N).map(resumen));
    if (modo === 'para-vos' && desde === 0 && (!yo || Date.now() - yo.creado < 7 * 86400000)) {
      const ev = await sorteo(env);
      if (ev) {
        const ids = ev.elegidos.map((x) => x.pack), dest = ids.length ? (await env.DB.prepare(`${CON_AUTOR} AND p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results.map((p) => ({ ...resumen(p), termo: true })) : [];
        packs = [...(await marcarLikes(env, yo, dest)), ...packs.filter((p) => !ids.includes(p.id))];
      }
    }
    return json({ packs, sigue: filas.length > N ? desde + N : null });
  }
  if (r === 'tendencias' && metodo === 'GET') {
    const { results } = await env.DB.prepare('SELECT tags, likes, descargas FROM packs WHERE oculto = 0 AND creado > ?').bind(Date.now() - 21 * 86400000).all(), c = new Map();
    for (const p of results) for (const t of p.tags.split(' ').filter(Boolean)) c.set(t, (c.get(t) || 0) + 1 + p.likes + p.descargas);
    return json({ tags: [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t) });
  }
  if (r === 'buscar' && metodo === 'GET') {
    const q = normal(u.searchParams.get('q')).replace(/^[#@]/, '').slice(0, 40);
    if (!q) return json({ packs: [], usuarios: [] });
    const like = '%' + q.replace(/[%_]/g, '') + '%';
    const packs = (await env.DB.prepare(`${CON_AUTOR}${sinBloqueados(yo)} AND p.busqueda LIKE ? ORDER BY (p.likes + p.descargas) DESC, p.creado DESC LIMIT 30`).bind(...(yo ? [yo.id] : []), like).all()).results.map(resumen);
    const usuarios = (await env.DB.prepare('SELECT * FROM usuarios WHERE bloqueado = 0 AND nombre LIKE ? ORDER BY seguidores DESC LIMIT 10').bind(like).all()).results.map(publico);
    return json({ packs: await marcarLikes(env, yo, packs), usuarios });
  }
  // ---- publicar, ver, actualizar, borrar un pack ----
  if (r === 'packs' && metodo === 'POST') return publicar(req, env, yo, null);
  if ((m = /^packs\/([a-z0-9]{10})$/.exec(r))) {
    const id = m[1];
    if (metodo === 'PUT') return publicar(req, env, yo, id);
    if (metodo === 'DELETE') {
      const p = await env.DB.prepare('SELECT autor FROM packs WHERE id = ?').bind(id).first();
      if (!yo || !p || p.autor !== yo.id) return error('Ese pack no es tuyo', 403);
      await borrarPack(env, id); return json({ ok: true });
    }
    if (metodo === 'GET') {
      // (uno oculto lo ve sólo su dueño)
      const p = await env.DB.prepare(`${TODOS_DE} AND p.id = ?`).bind(id).first();
      if (!p || (p.privado && (!yo || yo.id !== p.autor))) return error('Ese pack ya no está', 404);
      const out = resumen(p); out.stickers = JSON.parse(p.archivos);
      if (yo) {
        out.yaLike = !!(await env.DB.prepare('SELECT 1 FROM likes WHERE usuario = ? AND pack = ?').bind(yo.id, id).first());
        out.sigoAutor = !!(await env.DB.prepare('SELECT 1 FROM sigue WHERE usuario = ? AND sigue_a = ?').bind(yo.id, p.autor).first());
        out.esMio = p.autor === yo.id;
      }
      return json({ pack: out });
    }
  }
  // (ocultar o volver a mostrar un pack mío en la comunidad, sin borrarlo)
  if ((m = /^packs\/([a-z0-9]{10})\/privado$/.exec(r)) && metodo === 'POST') {
    const p = await env.DB.prepare('SELECT autor FROM packs WHERE id = ?').bind(m[1]).first();
    if (!yo || !p || p.autor !== yo.id) return error('Ese pack no es tuyo', 403);
    const { privado } = await cuerpo();
    await env.DB.prepare('UPDATE packs SET privado = ? WHERE id = ?').bind(privado ? 1 : 0, m[1]).run();
    return json({ ok: true, privado: !!privado });
  }
  // ---- el evento del termo: cuando 20 cuentas publicaron stickers, el termo elige 5 (para siempre) ----
  if (r === 'evento' && metodo === 'GET') return json(await evento(env));
  if ((m = /^packs\/([a-z0-9]{10})\/(like|descarga|reportar)$/.exec(r))) {
    const [, id, que] = m, p = await env.DB.prepare('SELECT id, autor, oculto FROM packs WHERE id = ?').bind(id).first();
    if (!p || p.oculto) return error('Ese pack ya no está', 404);
    if (que === 'descarga') {
      if (!(await limite(env, 'des:' + ip, 300, 3600))) return json({ ok: true });
      const nuevo = yo ? (await env.DB.prepare('INSERT OR IGNORE INTO descargas (usuario, pack) VALUES (?, ?)').bind(yo.id, id).run()).meta.changes : 1;
      if (nuevo) await env.DB.prepare('UPDATE packs SET descargas = descargas + 1 WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
    if (!yo) return error('Entrá con tu cuenta', 401);
    if (que === 'like') {
      if (metodo === 'POST') {
        if (!(await limite(env, 'like:' + yo.id, 400, 3600))) return error('Pará un poco con los me gusta 😅', 429);
        const ch = (await env.DB.prepare('INSERT OR IGNORE INTO likes (usuario, pack, creado) VALUES (?, ?, ?)').bind(yo.id, id, Date.now()).run()).meta.changes;
        if (ch) await env.DB.prepare('UPDATE packs SET likes = likes + 1 WHERE id = ?').bind(id).run();
      } else if (metodo === 'DELETE') {
        const ch = (await env.DB.prepare('DELETE FROM likes WHERE usuario = ? AND pack = ?').bind(yo.id, id).run()).meta.changes;
        if (ch) await env.DB.prepare('UPDATE packs SET likes = MAX(0, likes - 1) WHERE id = ?').bind(id).run();
      }
      const q = await env.DB.prepare('SELECT likes FROM packs WHERE id = ?').bind(id).first();
      return json({ likes: q.likes, yaLike: metodo === 'POST' });
    }
    if (que === 'reportar' && metodo === 'POST') {
      const { motivo } = await cuerpo(), mot = ['ofensivo', 'sexual', 'violencia', 'spam', 'otro'].includes(motivo) ? motivo : 'otro';
      await env.DB.prepare('INSERT OR IGNORE INTO reportes (usuario, pack, motivo, creado) VALUES (?, ?, ?, ?)').bind(yo.id, id, mot, Date.now()).run();
      const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM reportes WHERE pack = ?').bind(id).first()).n;
      await env.DB.prepare('UPDATE packs SET reportes = ?, oculto = CASE WHEN ? >= 3 THEN 1 ELSE oculto END WHERE id = ?').bind(n, n, id).run();
      return json({ ok: true, oculto: n >= 3 });
    }
  }
  // ---- perfiles, seguir, bloquear ----
  if ((m = /^usuarios\/([a-z0-9_.]{3,20})$/.exec(r)) && metodo === 'GET') {
    const usr = await env.DB.prepare('SELECT * FROM usuarios WHERE nombre = ? AND bloqueado = 0').bind(m[1]).first();
    if (!usr) return error('No encontré a @' + m[1], 404);
    const propio = !!yo && yo.id === usr.id, packs = (await env.DB.prepare(`${propio ? TODOS_DE : CON_AUTOR} AND p.autor = ? ORDER BY p.creado DESC LIMIT 60`).bind(usr.id).all()).results.map(resumen);
    const tot = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(descargas), 0) AS d, COALESCE(SUM(likes), 0) AS l FROM packs WHERE autor = ? AND oculto = 0 AND privado = 0').bind(usr.id).first();
    const ev = await sorteo(env), elegido = !!ev && ev.elegidos.some((x) => x.usuario === usr.id);
    const out = { usuario: { ...publico(usr), packs: tot.n, descargas: tot.d, likes: tot.l, insignias: elegido ? ['termo'] : [] }, packs: await marcarLikes(env, yo, packs) };
    if (yo) { out.sigo = !!(await env.DB.prepare('SELECT 1 FROM sigue WHERE usuario = ? AND sigue_a = ?').bind(yo.id, usr.id).first()); out.bloqueado = !!(await env.DB.prepare('SELECT 1 FROM bloqueos WHERE usuario = ? AND bloqueado = ?').bind(yo.id, usr.id).first()); out.soyYo = yo.id === usr.id;
      // (la amistad: nada, enviado —se la pedí—, recibido —me la pidió—, amigos)
      const am = await env.DB.prepare('SELECT de, estado FROM amigos WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)').bind(yo.id, usr.id, usr.id, yo.id).first();
      out.amistad = !am ? 'nada' : am.estado === 'amigos' ? 'amigos' : am.de === yo.id ? 'enviado' : 'recibido'; }
    return json(out);
  }
  if ((m = /^usuarios\/([a-z0-9]{10})\/reportar$/.exec(r)) && metodo === 'POST') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const u2 = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(m[1]).first(); if (!u2) return error('No existe', 404);
    const { motivo } = await cuerpo(), mot = ['ofensivo', 'sexual', 'violencia', 'spam', 'otro'].includes(motivo) ? motivo : 'otro';
    await env.DB.prepare('INSERT OR IGNORE INTO reportes (usuario, pack, motivo, creado) VALUES (?, ?, ?, ?)').bind(yo.id, 'u_' + u2.id, mot, Date.now()).run();
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM reportes WHERE pack = ?').bind('u_' + u2.id).first()).n;
    if (n >= 3) { const a = leerAvatar(u2); a.f = 0; a.b = 0; await env.DB.batch([env.DB.prepare('UPDATE usuarios SET avatar = ? WHERE id = ?').bind(JSON.stringify(a), u2.id), env.DB.prepare('DELETE FROM archivos WHERE pack = ?').bind('u_' + u2.id)]); }
    return json({ ok: true, sacada: n >= 3 });
  }
  if ((m = /^usuarios\/([a-z0-9]{10})\/(seguir|bloquear)$/.exec(r))) {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const [, id, que] = m;
    if (id === yo.id) return error(que === 'seguir' ? 'No te podés seguir a vos 😅' : 'No te podés bloquear a vos');
    if (!(await env.DB.prepare('SELECT 1 FROM usuarios WHERE id = ?').bind(id).first())) return error('No existe', 404);
    if (que === 'seguir') {
      if (metodo === 'POST') {
        if (!(await limite(env, 'seg:' + yo.id, 200, 3600))) return error('Pará un poco 😅', 429);
        if ((await env.DB.prepare('INSERT OR IGNORE INTO sigue (usuario, sigue_a, creado) VALUES (?, ?, ?)').bind(yo.id, id, Date.now()).run()).meta.changes)
          await env.DB.batch([env.DB.prepare('UPDATE usuarios SET seguidores = seguidores + 1 WHERE id = ?').bind(id), env.DB.prepare('UPDATE usuarios SET siguiendo = siguiendo + 1 WHERE id = ?').bind(yo.id)]);
      } else if (metodo === 'DELETE' && (await env.DB.prepare('DELETE FROM sigue WHERE usuario = ? AND sigue_a = ?').bind(yo.id, id).run()).meta.changes)
        await env.DB.batch([env.DB.prepare('UPDATE usuarios SET seguidores = MAX(0, seguidores - 1) WHERE id = ?').bind(id), env.DB.prepare('UPDATE usuarios SET siguiendo = MAX(0, siguiendo - 1) WHERE id = ?').bind(yo.id)]);
      const q = await env.DB.prepare('SELECT seguidores FROM usuarios WHERE id = ?').bind(id).first();
      return json({ sigo: metodo === 'POST', seguidores: q.seguidores });
    }
    if (metodo === 'POST') {
      await env.DB.prepare('INSERT OR IGNORE INTO bloqueos (usuario, bloqueado) VALUES (?, ?)').bind(yo.id, id).run();
      await socialAlBloquear(env.DB, yo.id, id);   // (bloquear corta la amistad y el chat)
      for (const [a, b] of [[yo.id, id], [id, yo.id]]) if ((await env.DB.prepare('DELETE FROM sigue WHERE usuario = ? AND sigue_a = ?').bind(a, b).run()).meta.changes)
        await env.DB.batch([env.DB.prepare('UPDATE usuarios SET seguidores = MAX(0, seguidores - 1) WHERE id = ?').bind(b), env.DB.prepare('UPDATE usuarios SET siguiendo = MAX(0, siguiendo - 1) WHERE id = ?').bind(a)]);
    } else if (metodo === 'DELETE') await env.DB.prepare('DELETE FROM bloqueos WHERE usuario = ? AND bloqueado = ?').bind(yo.id, id).run();
    return json({ bloqueado: metodo === 'POST' });
  }
  // ---- moderación (con ADMIN_CLAVE) ----
  if (r.startsWith('admin/')) {
    if (!env.ADMIN_CLAVE || req.headers.get('X-Admin') !== env.ADMIN_CLAVE) return error('No', 403);
    { const rk = await clipsAdmin(req, env, nubeDb(env), r, metodo, { json, error, cuerpo }); if (rk) return rk; }
    if (r === 'admin/social') { const ra = await socialAdmin(env.DB, r, metodo, metodo === 'POST' ? await cuerpo() : {}, { json, error, borrarArchivos: (pk) => borrarArchivos(env, pk) }); if (ra) return ra; }   // (publicaciones y mensajes denunciados)
    if (r === 'admin/reportados' && metodo === 'GET') {
      const { results } = await env.DB.prepare('SELECT p.*, u.nombre AS a_nombre, u.avatar AS a_avatar, u.premium_hasta AS a_premium, u.bloqueado AS a_bloq FROM packs p JOIN usuarios u ON u.id = p.autor WHERE p.reportes > 0 ORDER BY p.oculto DESC, p.reportes DESC LIMIT 100').all();
      const out = [];
      for (const p of results) { const mot = (await env.DB.prepare('SELECT motivo, COUNT(*) AS n FROM reportes WHERE pack = ? GROUP BY motivo').bind(p.id).all()).results; out.push({ ...resumen(p), oculto: !!p.oculto, reportes: p.reportes, motivos: mot, autorBloqueado: !!p.a_bloq }); }
      return json({ packs: out });
    }
    if ((m = /^admin\/packs\/([a-z0-9]{10})$/.exec(r)) && metodo === 'POST') {
      const { accion } = await cuerpo();
      if (accion === 'borrar') await borrarPack(env, m[1]);
      else if (accion === 'mostrar') await env.DB.batch([env.DB.prepare('UPDATE packs SET oculto = 0, reportes = 0 WHERE id = ?').bind(m[1]), env.DB.prepare('DELETE FROM reportes WHERE pack = ?').bind(m[1])]);
      else if (accion === 'ocultar') await env.DB.prepare('UPDATE packs SET oculto = 1 WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }
    // (lo cobrado: los últimos 200 pagos y la suma por tipo)
    if (r === 'admin/pagos' && metodo === 'GET') return json({ pagos: (await env.DB.prepare('SELECT p.*, u.nombre FROM pagos p LEFT JOIN usuarios u ON u.id = p.usuario ORDER BY p.creado DESC LIMIT 200').all()).results,
      totales: (await env.DB.prepare('SELECT tipo, moneda, COUNT(*) AS n, SUM(CAST(monto AS REAL)) AS suma FROM pagos GROUP BY tipo, moneda').all()).results });
    // (quitar el Premium a mano: devolución por arrepentimiento, contracargo o trampa; da de baja la suscripción)
    if (r === 'admin/premium' && metodo === 'POST') {
      const { nombre } = await cuerpo(), usr = await env.DB.prepare('SELECT id FROM usuarios WHERE nombre = ?').bind(String(nombre || '').replace(/^@/, '').toLowerCase()).first();
      if (!usr) return error('No existe esa cuenta', 404);
      const q = await quitarPremium(env, env.DB, usr.id, 'quitada'); return q ? json({ ok: true }) : error('Esa cuenta no tiene Premium', 409);
    }
    if (r === 'admin/contacto' && metodo === 'GET') return json({ mensajes: (await env.DB.prepare('SELECT * FROM contacto ORDER BY creado DESC LIMIT 100').all()).results });
    if ((m = /^admin\/contacto\/([a-z0-9]{10})$/.exec(r)) && metodo === 'DELETE') { await env.DB.prepare('DELETE FROM contacto WHERE id = ?').bind(m[1]).run(); return json({ ok: true }); }
    if ((m = /^admin\/usuarios\/([a-z0-9]{10})$/.exec(r)) && metodo === 'POST') {
      const { bloqueado } = await cuerpo();
      await env.DB.prepare('UPDATE usuarios SET bloqueado = ? WHERE id = ?').bind(bloqueado ? 1 : 0, m[1]).run();
      return json({ ok: true });
    }
  }
  return error('No existe', 404);
}

// ---- el evento del termo ----
// cuentas que cuentan: con al menos un pack público. Al llegar a META (20) se sortean 5 con números al azar de verdad y
// queda guardado (INSERT OR IGNORE: si dos lo sortean a la vez, gana el primero). De cada elegido va su pack más querido.
const metaEvento = (env) => Math.max(5, +(env.SZ_EVENTO_META || 20));
async function sorteo(env) { const f = await env.DB.prepare("SELECT datos FROM evento WHERE id = 'termo1'").first(); return f ? JSON.parse(f.datos) : null; }
async function evento(env) {
  const META = metaEvento(env);
  const { results: autores } = await env.DB.prepare(`SELECT p.autor AS id, MAX(p.likes * 3 + p.descargas * 2) AS punt FROM packs p JOIN usuarios u ON u.id = p.autor WHERE p.oculto = 0 AND p.privado = 0 AND u.bloqueado = 0 GROUP BY p.autor`).all();
  let ev = await sorteo(env);
  if (!ev && autores.length >= META) {
    const bolsa = autores.map((a) => a.id), elegidos = [];
    while (elegidos.length < 5 && bolsa.length) { const r = crypto.getRandomValues(new Uint32Array(1))[0] % bolsa.length; elegidos.push(bolsa.splice(r, 1)[0]); }
    const datos = { elegidos: [], cuentas: autores.length, sorteado: Date.now() };
    for (const u of elegidos) { const p = await env.DB.prepare(`${CON_AUTOR} AND p.autor = ? ORDER BY (p.likes * 3 + p.descargas * 2) DESC, p.creado DESC LIMIT 1`).bind(u).first(); if (p) datos.elegidos.push({ usuario: u, pack: p.id }); }
    await env.DB.prepare("INSERT OR IGNORE INTO evento (id, datos, creado) VALUES ('termo1', ?, ?)").bind(JSON.stringify(datos), Date.now()).run();
    ev = await sorteo(env);
  }
  // (lo que se muestra: el pack y su sticker de cada elegido, como están hoy)
  const elegidos = [];
  if (ev) for (const x of ev.elegidos) {
    const p = await env.DB.prepare(`${CON_AUTOR} AND p.id = ?`).bind(x.pack).first() || await env.DB.prepare(`${CON_AUTOR} AND p.autor = ? ORDER BY p.creado DESC LIMIT 1`).bind(x.usuario).first();
    if (p) { const r = resumen(p); elegidos.push({ autor: r.autor, pack: { id: r.id, nombre: r.nombre, v: r.v, sticker: r.muestra[0], bandeja: r.bandeja } }); }
  }
  return { meta: META, cuentas: ev ? Math.max(ev.cuentas, autores.length) : autores.length, sorteado: ev ? ev.sorteado : null, elegidos };
}
async function borrarPack(env, id) {
  await borrarArchivos(env, id);
  await env.DB.batch(['DELETE FROM likes WHERE pack = ?', 'DELETE FROM reportes WHERE pack = ?', 'DELETE FROM descargas WHERE pack = ?', 'DELETE FROM packs WHERE id = ?'].map((s) => env.DB.prepare(s).bind(id)));
}

// publicar (POST) o actualizar (PUT) un pack: «meta» (JSON) y un archivo por sticker y el ícono, en un formulario
async function publicar(req, env, yo, id) {
  if (!yo) return error('Entrá con tu cuenta para publicar', 401);
  let viejo = null;
  if (id) { viejo = await env.DB.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first(); if (!viejo || viejo.autor !== yo.id) return error('Ese pack no es tuyo', 403); }
  if (!(await limite(env, 'pub:' + yo.id, 15, 86400))) return error('Ya publicaste mucho hoy. Seguí mañana 🙌', 429);
  let fd; try { fd = await req.formData(); } catch (e) { return error('Faltan los archivos'); }
  let meta; try { meta = JSON.parse(fd.get('meta')); } catch (e) { return error('Faltan los datos del pack'); }
  const nombre = String(meta.nombre || '').trim().slice(0, 40), animado = !!meta.animado, sts = Array.isArray(meta.stickers) ? meta.stickers : [];
  if (!nombre) return error('Ponele nombre al pack');
  if (sts.length < 3 || sts.length > 30) return error('Un pack tiene de 3 a 30 stickers');
  const tags = [...new Set((Array.isArray(meta.tags) ? meta.tags : []).map((t) => normal(t).replace(/^#/, '').replace(/[^a-z0-9ñ]/g, '')).filter((t) => t.length >= 2 && t.length <= 20))].slice(0, 5);
  const textos = String(meta.textos || '').slice(0, 600);
  if ([nombre, textos, tags.join(' ')].some(textoProhibido)) return error('Ese pack tiene palabras que no se pueden publicar');
  const nombreOk = (n) => typeof n === 'string' && /^[A-Za-z0-9_-]{1,40}\.(webp|png)$/.test(n);
  const archivos = [], ops = [];
  const pid = id || nuevoId();
  for (const s of sts) {
    if (!nombreOk(s.archivo) || !s.archivo.endsWith('.webp')) return error('Nombre de sticker raro');
    const f = fd.get(s.archivo); if (!f || typeof f === 'string') return error('Falta ' + s.archivo);
    const b = new Uint8Array(await f.arrayBuffer()), inf = infoWebP(b);
    if (!inf || inf.w !== 512 || inf.h !== 512) return error('Cada sticker tiene que ser un WebP de 512×512');
    if (inf.animado !== animado) return error(animado ? 'En un pack animado van sólo animados' : 'En este pack van sólo stickers quietos');
    if (b.length > (animado ? 500 : 100) * 1024) return error('Un sticker pesa demasiado');
    const emojis = (Array.isArray(s.emojis) ? s.emojis : []).filter((e) => typeof e === 'string' && e.length <= 8).slice(0, 3);
    archivos.push({ archivo: s.archivo, emojis: emojis.length ? emojis : ['😂'] });
    ops.push(await guardarArchivo(env, pid, s.archivo, 'image/webp', b));
  }
  if (new Set(archivos.map((a) => a.archivo)).size !== archivos.length) return error('Hay stickers repetidos');
  const bn = meta.bandeja, fb = nombreOk(bn) && bn.endsWith('.png') ? fd.get(bn) : null;
  if (!fb || typeof fb === 'string') return error('Falta el ícono del pack');
  const bb = new Uint8Array(await fb.arrayBuffer()), ib = infoPNG(bb);
  if (!ib || ib.w !== 96 || ib.h !== 96 || bb.length > 50 * 1024) return error('El ícono tiene que ser un PNG de 96×96');
  if (viejo) await borrarArchivos(env, pid);
  ops.push(await guardarArchivo(env, pid, bn, 'image/png', bb));
  const busqueda = normal([nombre, tags.join(' '), textos, archivos.flatMap((a) => a.emojis).join(' '), yo.nombre].join(' '));
  if (viejo) ops.push(env.DB.prepare('UPDATE packs SET nombre = ?, tags = ?, busqueda = ?, animado = ?, archivos = ?, bandeja = ?, v = v + 1 WHERE id = ?').bind(nombre, tags.join(' '), busqueda, animado ? 1 : 0, JSON.stringify(archivos), bn, pid));
  else ops.push(env.DB.prepare('INSERT INTO packs (id, autor, nombre, tags, busqueda, animado, archivos, bandeja, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(pid, yo.id, nombre, tags.join(' '), busqueda, animado ? 1 : 0, JSON.stringify(archivos), bn, Date.now()));
  await env.DB.batch(ops);
  const p = await env.DB.prepare('SELECT p.*, u.nombre AS a_nombre, u.avatar AS a_avatar, u.premium_hasta AS a_premium FROM packs p JOIN usuarios u ON u.id = p.autor WHERE p.id = ?').bind(pid).first();
  return json({ pack: resumen(p) }, viejo ? 200 : 201);
}

// los archivos (con el número de versión en la dirección: se guardan en la caché para siempre)
async function imagenPerfil(req, env, ctx, ruta) {
  const m = /^\/u\/([a-z0-9]{10})\/(foto|portada)$/.exec(ruta); if (!m) return new Response('No está', { status: 404, headers: CORS });
  const cache = typeof caches !== 'undefined' ? caches.default : null; if (cache) { const c = await cache.match(req); if (c) return c; }
  const r = await env.DB.prepare('SELECT a.tipo, a.datos FROM archivos a JOIN usuarios u ON u.id = ? WHERE a.pack = ? AND a.nombre = ? AND u.bloqueado = 0').bind(m[1], 'u_' + m[1], m[2]).first();
  if (!r) return new Response('No está', { status: 404, headers: CORS });
  const res = new Response(bytesDe(r.datos), { headers: { 'Content-Type': r.tipo, 'Cache-Control': 'public, max-age=86400', ...CORS } });
  if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(req, res.clone()));
  return res;
}
// (las imágenes de las publicaciones —si no están ocultas— y los stickers propios del chat, con su clave al azar)
async function mediaSocial(req, env, ctx, ruta) {
  let m = /^\/s\/([a-z0-9]{10})\/([0-3])\.webp$/.exec(ruta), pack, nombre;
  if (m) { const p = await env.DB.prepare('SELECT 1 FROM posts WHERE id = ? AND oculto = 0').bind(m[1]).first(); if (!p && !(env.ADMIN_CLAVE && req.headers.get('X-Admin') === env.ADMIN_CLAVE)) return new Response('No está', { status: 404, headers: CORS }); pack = 'p_' + m[1]; nombre = m[2] + '.webp'; }
  else if ((m = /^\/c\/([a-z0-9]{10})\/st\.webp$/.exec(ruta))) { pack = 'c_' + m[1]; nombre = 'st.webp'; }
  else return new Response('No está', { status: 404, headers: CORS });
  const r = await env.DB.prepare('SELECT tipo, datos FROM archivos WHERE pack = ? AND nombre = ?').bind(pack, nombre).first();
  if (!r) return new Response('No está', { status: 404, headers: CORS });
  let datos = bytesDe(r.datos);
  if (!datos && env.MEDIA) { const o = await env.MEDIA.get(`${pack}/${nombre}`); if (!o) return new Response('No está', { status: 404, headers: CORS }); datos = new Uint8Array(await o.arrayBuffer()); }
  return new Response(datos, { headers: { 'Content-Type': r.tipo, 'Cache-Control': 'private, max-age=3600', ...CORS } });
}
async function media(req, env, ctx, ruta) {
  const m = /^\/m\/([a-z0-9]{10})\/([A-Za-z0-9_-]{1,40}\.(?:webp|png))$/.exec(ruta);
  if (!m) return new Response('No está', { status: 404, headers: CORS });
  // (la moderación ve también los ocultos; eso no se guarda en la caché)
  const admin = !!env.ADMIN_CLAVE && req.headers.get('X-Admin') === env.ADMIN_CLAVE, cache = !admin && typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const c = await cache.match(req); if (c) return c; }
  const r = await env.DB.prepare(`SELECT a.tipo, a.datos FROM archivos a JOIN packs p ON p.id = a.pack WHERE a.pack = ? AND a.nombre = ?${admin ? '' : ' AND p.oculto = 0'}`).bind(m[1], m[2]).first();
  if (!r) return new Response('No está', { status: 404, headers: CORS });
  let datos = bytesDe(r.datos);
  if (!datos && env.MEDIA) { const o = await env.MEDIA.get(`${m[1]}/${m[2]}`); if (!o) return new Response('No está', { status: 404, headers: CORS }); datos = new Uint8Array(await o.arrayBuffer()); }
  // (un día: si un pack se borra o se oculta, deja de verse a más tardar al otro día también por su dirección)
  const res = new Response(datos, { headers: { 'Content-Type': r.tipo, 'Cache-Control': admin ? 'no-store' : 'public, max-age=86400', ...CORS } });
  if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(req, res.clone()));
  return res;
}

// ---- páginas ----
const botonTienda = (origen) => `<a class="b" href="${bajar(origen)}">Bajá Stickerazo</a>`;
function pagina(titulo, cuerpo, cabeza = '') {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>${cabeza}
<style>body{margin:0;background:#14121c;color:#f5f3fb;font:16px/1.5 system-ui,sans-serif}main{max-width:640px;margin:0 auto;padding:24px 18px 48px}h1{font-size:28px;margin:8px 0}a{color:#ffd23f}
.b{display:block;text-align:center;margin:14px 0;padding:15px;border-radius:999px;background:#ffd23f;color:#1c1503;font-weight:800;text-decoration:none}.s{background:#25d366;color:#04260f}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.g img{width:100%;aspect-ratio:1;object-fit:contain;background:#201d2c;border-radius:16px}.p{color:#a7a2bb}</style></head><body><main>${cuerpo}</main></body></html>`;
}
async function compartir(env, id, origen) {
  if (!/^[a-z0-9]{10}$/.test(id)) return html(pagina('No está', '<h1>Ese pack no está</h1>' + botonTienda(origen)), 404);
  const p = await env.DB.prepare(`${CON_AUTOR} AND p.id = ?`).bind(id).first();
  if (!p) return html(pagina('No está', '<h1>Ese pack ya no está</h1>' + botonTienda(origen)), 404);
  const r = resumen(p), m = (a) => `${origen}/m/${p.id}/${a}?v=${p.v}`, todos = JSON.parse(p.archivos);
  const abrir = `intent://pack/${p.id}#Intent;scheme=stickerazo;package=com.stickerazo.app;S.browser_fallback_url=${encodeURIComponent(bajar(origen))};end`;
  const cabeza = `<meta property="og:title" content="${esc(r.nombre)} · Stickerazo"><meta property="og:description" content="${r.n} stickers de @${esc(r.autor.nombre)} para WhatsApp"><meta property="og:image" content="${m(p.bandeja)}">`;
  return html(pagina(`${r.nombre} · Stickerazo`, `<p class="p">Pack de @${esc(r.autor.nombre)} · ${r.n} stickers${r.animado ? ' animados' : ''}</p><h1>${esc(r.nombre)}</h1>
    <a class="b s" href="${abrir}">Abrir en Stickerazo y agregar a WhatsApp</a><div class="g">${todos.map((a) => `<img src="${m(a.archivo)}" alt="">`).join('')}</div>
    <p class="p">¿No tenés la app? Es gratis, sin marca de agua y las fotos no salen de tu celular.</p>${botonTienda(origen)}`, cabeza));
}
const PRIVACIDAD = `<h1>Privacidad</h1><p class="p">Stickerazo · versión corta (la completa no cargó: recargá en un rato)</p>
<p><b>Tus fotos no salen de tu celular.</b> Sólo sube lo que publicás en la comunidad. Entrás con Google: de tu cuenta de Google guardamos sólo una huella de su identificador, no tu mail ni tu nombre. Tu @, tu bio, tu avatar, tu foto y tu portada (si las ponés) y tus packs publicados los ve cualquiera.</p>
<p>No vendemos datos. Los anuncios los muestra Google (AdMob), con su aviso de consentimiento donde corresponde; con Premium no hay anuncios. Premium y las donaciones se pagan en PayPal: no vemos tu tarjeta, sólo guardamos el número de la orden, el monto y la fecha. Los datos viajan cifrados y los guarda Cloudflare. Borrás todo al instante desde la app (Perfil → Borrar mi cuenta) o desde <a href="borrar-cuenta">esta página</a>. Para tus derechos, escribinos desde <a href="contacto">contacto</a>.</p>`;
const TERMINOS = `<h1>Términos y reglas</h1><p class="p">Versión corta (la completa no cargó: recargá en un rato)</p><p>Lo que publicás es tuyo y nos das permiso para mostrarlo en la comunidad. No se puede publicar contenido sexual, odio o discriminación, violencia, acoso, datos de otras personas, ni fotos de alguien que no quiere aparecer. Los packs con 3 denuncias se ocultan hasta que los revisemos, y las cuentas que no respetan esto se bloquean. Tenés que tener 13 años o más. La app es gratis y se ofrece tal como está, sin afectar tus derechos como consumidor. Premium es opcional, se paga con PayPal y se da de baja cuando quieras desde la app; tenés 10 días para arrepentirte de una compra y que te devolvamos todo. Rige la ley argentina.</p>`;
const BORRAR = `<h1>Borrar tu cuenta</h1><p>Abrí Stickerazo → Perfil → <b>Borrar mi cuenta</b>. Se borran al instante tu cuenta, tus packs publicados, tus me gusta y a quién seguís. Los stickers que tenés guardados en el celular quedan en tu celular.</p><p>Sin la app: <a href="borrar">entrá con tu cuenta de Google y borrala desde acá</a>.</p>`;
const CONTACTO = `<h1>Contacto</h1><p>Escribinos desde la app (Perfil → Ajustes) o volvé en un rato: el formulario no cargó.</p>`;
const paginaAdmin = (base) => pagina('Moderación · Stickerazo', `<h1>Moderación</h1><input id="k" type="password" placeholder="Clave" style="width:100%;padding:12px;border-radius:12px;border:0"><button class="b" id="v" style="width:100%;border:0">Ver denunciados</button><button class="b" id="vm" style="width:100%;border:0">Ver mensajes de contacto</button><button class="b" id="vp" style="width:100%;border:0">Ver pagos (Premium y donaciones)</button><div id="l"></div>
<script>const k=document.getElementById('k'),l=document.getElementById('l');k.value=localStorage.k||'';
const api=(r,o={})=>fetch('${base}/api/admin/'+r,{...o,headers:{'X-Admin':k.value,'Content-Type':'application/json'}}).then(x=>x.json());
async function ver(){localStorage.k=k.value;const d=await api('reportados');if(d.error){l.textContent=d.error;return}
l.innerHTML=d.packs.map(p=>'<div style="background:#201d2c;border-radius:16px;padding:12px;margin:12px 0"><b>'+p.nombre+'</b> de @'+p.autor.nombre+' · '+p.reportes+' denuncias ('+p.motivos.map(m=>m.motivo+' '+m.n).join(', ')+')'+(p.oculto?' · OCULTO':'')+
'<div class="g">'+p.muestra.map(a=>'<img data-s="${base}/m/'+p.id+'/'+a+'?v='+p.v+'">').join('')+'</div><button data-a="mostrar" data-p="'+p.id+'">Mostrar</button> <button data-a="ocultar" data-p="'+p.id+'">Ocultar</button> <button data-a="borrar" data-p="'+p.id+'">Borrar</button> <button data-u="'+p.autor.id+'">Bloquear a @'+p.autor.nombre+'</button></div>').join('')||'Nada denunciado 🙌';
for(const i of l.querySelectorAll('img[data-s]'))fetch(i.dataset.s,{headers:{'X-Admin':k.value}}).then(r=>r.blob()).then(b=>i.src=URL.createObjectURL(b))}
async function mensajes(){localStorage.k=k.value;const d=await api('contacto');if(d.error){l.textContent=d.error;return}
const t=(x)=>String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
l.innerHTML=d.mensajes.map(m=>'<div style="background:#201d2c;border-radius:16px;padding:12px;margin:12px 0"><b>'+t(m.motivo)+'</b> · '+new Date(m.creado).toLocaleString()+(m.mail?' · '+t(m.mail):'')+'<p style="white-space:pre-wrap">'+t(m.texto)+'</p><button data-m="'+m.id+'">Borrar</button></div>').join('')||'Sin mensajes 🙌'}
async function pagos(){localStorage.k=k.value;const d=await api('pagos');if(d.error){l.textContent=d.error;return}const t=(x)=>String(x??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
l.innerHTML='<p><b>Totales:</b> '+(d.totales.map(x=>t(x.tipo)+': '+x.n+' (US$ '+Number(x.suma).toFixed(2)+')').join(' · ')||'nada todavía')+'</p><p><input id="qp" placeholder="@cuenta" style="padding:10px;border-radius:10px;border:0"> <button id="qb">Quitar Premium (devolución o contracargo)</button></p>'+d.pagos.map(p=>'<div style="background:#201d2c;border-radius:12px;padding:10px;margin:8px 0">'+new Date(p.creado).toLocaleString()+' · <b>'+t(p.tipo)+'</b> US$ '+t(p.monto)+' · @'+t(p.nombre||p.usuario)+' · <small>'+t(p.id)+'</small></div>').join('');
document.getElementById('qb').onclick=async()=>{const n=document.getElementById('qp').value.trim();if(!n||!confirm('¿Quitarle Premium a '+n+'? Si paga por mes o por año, se da de baja en PayPal.'))return;const r=await api('premium',{method:'POST',body:JSON.stringify({nombre:n})});alert(r.ok?'Listo':(r.error||'No se pudo'));pagos()}}
document.getElementById('v').onclick=ver;document.getElementById('vm').onclick=mensajes;document.getElementById('vp').onclick=pagos;l.onclick=async e=>{const b=e.target;if(b.dataset.m){await api('contacto/'+b.dataset.m,{method:'DELETE'});mensajes();return}if(b.dataset.p){await api('packs/'+b.dataset.p,{method:'POST',body:JSON.stringify({accion:b.dataset.a})});ver()}if(b.dataset.u){await api('usuarios/'+b.dataset.u,{method:'POST',body:JSON.stringify({bloqueado:1})});ver()}};</script>`);
