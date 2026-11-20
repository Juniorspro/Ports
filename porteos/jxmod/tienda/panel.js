// ---------------- el panel de JXMod: bugs y sugerencias, quién juega, errores y las órdenes del dueño ----------------
// Lo público (el juego):
//  · Bugs y sugerencias (el menú del juego): la gente publica con texto, imágenes y videos (con la sesión de Google, si
//    las cuentas están encendidas); se ven todos, se votan y se denuncian (con 3 denuncias se oculta solo). El dueño y
//    Claude contestan, les ponen estado (nuevo, visto, en curso, hecho, no) o los ocultan.
//    GET /api/panel/posts?tipo=bug|sug&orden=nuevo|pop&p=N · GET /api/panel/post/ID · POST /api/panel/post
//    POST /api/panel/media (en partes de hasta 1,5 MB: imágenes y videos de hasta 24 MB) · GET /api/panel/media/ID
//    POST /api/panel/voto/ID {k: 'like'|'denuncia'}
//  · POST /api/panel/hola: cada juego abierto avisa cada 25 s qué versión, en qué mapa y server está (con un id de aparato
//    al azar y el nombre que puso; nada más), manda sus errores de JS (sin repetir) y se lleva las órdenes que haya.
// Lo del dueño (la app admin, web/panel) y de Claude (herramientas/panel.py): POST /api/panel/admin {q, cert, firma}.
//  · q es el pedido en JSON con su hora (vale 5 minutos) y firma es ECDSA P-256 sobre «JXPANEL1\n» + q.
//  · Claude firma con la llave de los eventos en vivo (VIVO_PUB, la misma de vivo.js; la privada no está acá).
//  · Cada celular del dueño tiene su propia llave (la genera la app y no sale de ahí): pide entrar (POST
//    /api/panel/solicitud), Claude la aprueba firmando su certificado con la llave de los eventos en vivo, y la app se lo
//    lleva (GET /api/panel/cert). Un certificado se puede dar de baja.
//  · Las órdenes a los juegos (aviso arriba, pantalla en el cielo, cinemática, ir a un mapa, guion) van firmadas por
//    quien las da; el juego comprueba esa firma él mismo (panel_juego.js): ni este servidor puede inventar una.
const VIVO_PUB = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEiUteKCCZn1+v7no/VloHzEYu1X0Cwqglqy7JmwI9NiiX6O1GGtOVfXqPST8OxETNBf7PUMqUBzTgEvh2uZkvAg==';
const MIN = 60e3, HORA = 3600e3, DIA = 86400e3;
const PARTE = 1572864, MEDIA_MAX = 24 * 1048576, MEDIA_DIA = 120 * 1048576, MIMES = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/;
const ESTADOS = ['nuevo', 'visto', 'en_curso', 'hecho', 'no'], TIPOS_PUB = ['bug', 'sug'], TIPOS_ADMIN = ['bug', 'sug', 'idea', 'nota'];
const ORDENES = ['aviso', 'cielo', 'cine', 'ir', 'guion', 'quitar'];
const enc = new TextEncoder();
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s)));
const b64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const azar = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const limpio = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max);
const linea = (v, max) => limpio(v, max).replace(/\s+/g, ' ');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

let listas = false;
async function tablas(env) {
  if (listas) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pn_posts (id TEXT PRIMARY KEY, tipo TEXT, titulo TEXT, texto TEXT, media TEXT, autor TEXT, nombre TEXT, version TEXT, lugar TEXT, estado TEXT, respuesta TEXT, resp_de TEXT, likes INTEGER DEFAULT 0, denuncias INTEGER DEFAULT 0, oculto INTEGER DEFAULT 0, privado INTEGER DEFAULT 0, creado INTEGER, cambiado INTEGER, ip TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_pn_posts ON pn_posts(tipo, oculto, privado, creado)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pn_media (id TEXT, parte INTEGER, datos BLOB, mime TEXT, partes INTEGER, tam INTEGER, autor TEXT, creado INTEGER, PRIMARY KEY (id, parte))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pn_votos (post TEXT, quien TEXT, k TEXT, PRIMARY KEY (post, quien, k))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pn_presencia (d TEXT PRIMARY KEY, nombre TEXT, version TEXT, plat TEXT, mapa TEXT, sala TEXT, visto INTEGER, primero INTEGER, ip TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pn_errores (h TEXT PRIMARY KEY, msg TEXT, version TEXT, n INTEGER, aparatos INTEGER, primero INTEGER, ultimo INTEGER, estado TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pn_ordenes (id INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT, f TEXT, c TEXT, tipo TEXT, de TEXT, creada INTEGER, hasta INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pn_admins (pub TEXT PRIMARY KEY, nombre TEXT, cert TEXT, estado TEXT, pedido INTEGER, desde INTEGER, ip TEXT)'),
  ]);
  listas = true;
}

// ---------------- firmas ----------------
const claves = new Map();
async function claveDe(pub) { let k = claves.get(pub); if (!k) { k = await crypto.subtle.importKey('spki', b64(pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); claves.set(pub, k); } return k; }
async function firmaBien(pub, firma, txt) { try { return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await claveDe(pub), b64(firma), enc.encode(txt)); } catch (e) { return false; } }
// el certificado de un celular del dueño: {pub, nombre, desde, firma} firmado por Claude sobre «JXADMIN1\npub\nnombre\ndesde»
async function certBien(c) { return !!(c && typeof c.pub === 'string' && typeof c.firma === 'string' && (await firmaBien(VIVO_PUB, c.firma, `JXADMIN1\n${c.pub}\n${c.nombre}\n${c.desde}`))); }
// ¿quién firmó este pedido? 'claude', el nombre del celular aprobado, o nada
async function quien(env, b) {
  if (!b || typeof b.q !== 'string' || typeof b.firma !== 'string' || b.q.length > 2.2e6) return null;
  let q; try { q = JSON.parse(b.q); } catch (e) { return null; }
  if (!q || typeof q.t !== 'number' || Math.abs(Date.now() - q.t) > 5 * MIN) return null;
  if (!b.cert) return (await firmaBien(VIVO_PUB, b.firma, 'JXPANEL1\n' + b.q)) ? { de: 'claude', q } : null;
  let c = b.cert; if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { return null; } }
  if (!(await certBien(c))) return null;
  const fila = await env.DB.prepare('SELECT estado FROM pn_admins WHERE pub = ?1').bind(c.pub).first();
  if (!fila || fila.estado !== 'ok') return null;   // (dado de baja, o nunca aprobado acá)
  return (await firmaBien(c.pub, b.firma, 'JXPANEL1\n' + b.q)) ? { de: linea(c.nombre, 30) || 'dueño', q, cert: c } : null;
}

// ---------------- los posts ----------------
const mediaLista = (m) => { try { return (JSON.parse(m || '[]') || []).slice(0, 8); } catch (e) { return []; } };
const postPublico = (f, detalle) => ({ id: f.id, tipo: f.tipo, titulo: f.titulo, texto: detalle ? f.texto : f.texto.slice(0, 280), media: mediaLista(f.media), nombre: f.nombre, version: f.version, lugar: f.lugar, estado: f.estado, respuesta: f.respuesta, resp_de: f.resp_de, likes: f.likes, creado: f.creado, cambiado: f.cambiado });
async function mediaValida(env, lista) {
  const L = [];
  for (const x of (Array.isArray(lista) ? lista : []).slice(0, 8)) {
    const id = String(x && x.id || ''); if (!/^[a-z0-9]{12}$/.test(id)) continue;
    const f = await env.DB.prepare('SELECT mime, partes, tam FROM pn_media WHERE id = ?1 AND parte = 0').bind(id).first(); if (!f) continue;
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM pn_media WHERE id = ?1').bind(id).first(); if (!n || n.n !== f.partes) continue;   // (completo)
    L.push({ id, mime: f.mime, tam: f.tam, w: +x.w || 0, h: +x.h || 0, dur: +x.dur || 0 });
  }
  return L;
}
async function postNuevo(env, d, autor, nombre, ip, privado) {
  const tipo = (privado ? TIPOS_ADMIN : TIPOS_PUB).includes(d.tipo) ? d.tipo : null, titulo = linea(d.titulo, 90), texto = limpio(d.texto, 4000);
  if (!tipo || titulo.length < 3) return { error: 'falta el título (y el tipo)' };
  const media = await mediaValida(env, d.media), id = azar(8), ahora = Date.now();
  await env.DB.prepare('INSERT INTO pn_posts (id, tipo, titulo, texto, media, autor, nombre, version, lugar, estado, likes, denuncias, oculto, privado, creado, cambiado, ip) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, 0, 0, ?11, ?12, ?12, ?13)')
    .bind(id, tipo, titulo, texto, JSON.stringify(media), autor, linea(nombre, 30), linea(d.version, 20), linea(d.lugar, 80), 'nuevo', privado ? 1 : 0, ahora, ip).run();
  return { id };
}

// ---------------- lo que manda el admin (o Claude) ----------------
async function admin(env, Q, ip, json) {
  const { de, q } = Q, op = q.op, ahora = Date.now();
  if (op === 'estado') {
    const jugando = await env.DB.prepare('SELECT d, nombre, version, plat, mapa, sala, visto, primero FROM pn_presencia WHERE visto > ?1 ORDER BY visto DESC LIMIT 300').bind(ahora - 2 * MIN).all();
    const hoy = await env.DB.prepare('SELECT COUNT(*) AS n FROM pn_presencia WHERE visto > ?1').bind(ahora - DIA).first();
    const semana = await env.DB.prepare('SELECT COUNT(*) AS n FROM pn_presencia WHERE visto > ?1').bind(ahora - 7 * DIA).first();
    const nuevos = await env.DB.prepare('SELECT COUNT(*) AS n FROM pn_presencia WHERE primero > ?1').bind(ahora - DIA).first();
    const versiones = await env.DB.prepare('SELECT version, COUNT(*) AS n FROM pn_presencia WHERE visto > ?1 GROUP BY version ORDER BY n DESC LIMIT 12').bind(ahora - 7 * DIA).all();
    const posts = await env.DB.prepare("SELECT tipo, estado, COUNT(*) AS n FROM pn_posts WHERE oculto = 0 GROUP BY tipo, estado").all();
    const errores = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(n) AS veces FROM pn_errores WHERE ultimo > ?1 AND (estado IS NULL OR estado != 'hecho')").bind(ahora - 7 * DIA).first();
    const ordenes = await env.DB.prepare("SELECT id, a, tipo, de, creada, hasta FROM pn_ordenes WHERE hasta > ?1 AND tipo != 'quitar' ORDER BY id DESC LIMIT 20").bind(ahora).all();
    return json({ ahora, de, jugando: jugando.results, hoy: hoy.n, semana: semana.n, nuevos: nuevos.n, versiones: versiones.results, posts: posts.results, errores, ordenes: ordenes.results });
  }
  if (op === 'posts') {
    const tipo = TIPOS_ADMIN.includes(q.tipo) ? q.tipo : null, estado = ESTADOS.includes(q.estado) ? q.estado : null, p = Math.max(0, Math.min(500, +q.p || 0));
    let where = '1 = 1'; const args = [];
    if (tipo) { args.push(tipo); where += ' AND tipo = ?' + args.length; }
    if (estado) { args.push(estado); where += ' AND estado = ?' + args.length; }
    if (!q.ocultos) where += ' AND oculto = 0';
    const f = await env.DB.prepare(`SELECT * FROM pn_posts WHERE ${where} ORDER BY creado DESC LIMIT 30 OFFSET ${p * 30}`).bind(...args).all();
    return json({ posts: f.results.map((x) => ({ ...postPublico(x, true), denuncias: x.denuncias, oculto: x.oculto, privado: x.privado, autor: x.autor })) });
  }
  if (op === 'post') {
    const r = await postNuevo(env, q, 'admin:' + de, de === 'claude' ? 'Claude' : de, ip, true); return json(r, r.error ? 400 : 200);
  }
  if (op === 'post_cambiar') {
    const f = await env.DB.prepare('SELECT id FROM pn_posts WHERE id = ?1').bind(String(q.id)).first(); if (!f) return json({ error: 'no existe' }, 404);
    if (q.estado !== undefined && ESTADOS.includes(q.estado)) await env.DB.prepare('UPDATE pn_posts SET estado = ?2, cambiado = ?3 WHERE id = ?1').bind(f.id, q.estado, ahora).run();
    if (q.respuesta !== undefined) await env.DB.prepare('UPDATE pn_posts SET respuesta = ?2, resp_de = ?3, cambiado = ?4 WHERE id = ?1').bind(f.id, limpio(q.respuesta, 3000), de === 'claude' ? 'Claude' : de, ahora).run();
    if (q.oculto !== undefined) await env.DB.prepare('UPDATE pn_posts SET oculto = ?2, cambiado = ?3 WHERE id = ?1').bind(f.id, q.oculto ? 1 : 0, ahora).run();
    return json({ ok: true });
  }
  if (op === 'post_borrar') {
    const f = await env.DB.prepare('SELECT media FROM pn_posts WHERE id = ?1').bind(String(q.id)).first(); if (!f) return json({ error: 'no existe' }, 404);
    for (const m of mediaLista(f.media)) await env.DB.prepare('DELETE FROM pn_media WHERE id = ?1').bind(m.id).run();
    await env.DB.prepare('DELETE FROM pn_posts WHERE id = ?1').bind(String(q.id)).run(); await env.DB.prepare('DELETE FROM pn_votos WHERE post = ?1').bind(String(q.id)).run();
    return json({ ok: true });
  }
  if (op === 'media_parte') {   // (las fotos y videos del admin: en partes en base64 dentro del pedido firmado)
    let u; try { u = b64(String(q.datos || '')); } catch (e) { return json({ error: 'datos' }, 400); }
    return mediaGuardar(env, json, { id: q.id, parte: +q.parte || 0, partes: +q.partes || 1, mime: String(q.mime || ''), tam: +q.tam || 0 }, u, 'admin:' + de);
  }
  if (op === 'errores') {
    const f = await env.DB.prepare('SELECT * FROM pn_errores ORDER BY ultimo DESC LIMIT 100').all(); return json({ errores: f.results });
  }
  if (op === 'error_estado') { await env.DB.prepare('UPDATE pn_errores SET estado = ?2 WHERE h = ?1').bind(String(q.h), linea(q.estado, 12)).run(); return json({ ok: true }); }
  if (op === 'orden') {
    // la orden la firma quien la da (el juego lo comprueba); acá se comprueba también, que no se guarde basura
    const a = String(q.a || ''), f = String(q.f || ''); let o; try { o = JSON.parse(a); } catch (e) { return json({ error: 'orden' }, 400); }
    if (!o || !ORDENES.includes(o.tipo) || !(o.hasta > ahora) || o.hasta - ahora > 7 * DIA || a.length > 600000) return json({ error: 'orden inválida' }, 400);
    const ok = Q.cert ? await firmaBien(Q.cert.pub, f, 'JXORDEN1\n' + a) : await firmaBien(VIVO_PUB, f, 'JXORDEN1\n' + a);
    if (!ok) return json({ error: 'firma de la orden' }, 400);
    const r = await env.DB.prepare('INSERT INTO pn_ordenes (a, f, c, tipo, de, creada, hasta) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(a, f, Q.cert ? JSON.stringify(Q.cert) : null, o.tipo, de, ahora, o.hasta).run();
    // (quitar una orden: la de antes vence ya, además de mandarse el «quitar» a los que la tienen puesta)
    if (o.tipo === 'quitar' && o.datos && o.datos.uid) {
      const L = await env.DB.prepare('SELECT id, a FROM pn_ordenes WHERE hasta > ?1').bind(ahora).all();
      for (const x of L.results) { try { if (JSON.parse(x.a).uid === o.datos.uid) await env.DB.prepare('UPDATE pn_ordenes SET hasta = ?2 WHERE id = ?1').bind(x.id, ahora).run(); } catch (e) {} }
    }
    return json({ ok: true, id: r.meta && r.meta.last_row_id });
  }
  if (op === 'ordenes') { const f = await env.DB.prepare('SELECT id, a, tipo, de, creada, hasta FROM pn_ordenes ORDER BY id DESC LIMIT 60').all(); return json({ ordenes: f.results }); }
  // (sólo Claude: aprobar o dar de baja los celulares del dueño)
  if (op === 'admins') { const f = await env.DB.prepare('SELECT pub, nombre, estado, pedido, desde FROM pn_admins ORDER BY pedido DESC LIMIT 50').all(); return json({ admins: f.results }); }
  if (op === 'aprobar' && de === 'claude') {
    const c = q.cert; if (!(await certBien(c))) return json({ error: 'certificado' }, 400);
    await env.DB.prepare("INSERT INTO pn_admins (pub, nombre, cert, estado, pedido, desde) VALUES (?1, ?2, ?3, 'ok', ?4, ?4) ON CONFLICT(pub) DO UPDATE SET nombre = ?2, cert = ?3, estado = 'ok', desde = ?4").bind(c.pub, linea(c.nombre, 30), JSON.stringify(c), ahora).run();
    return json({ ok: true });
  }
  if (op === 'baja' && de === 'claude') { await env.DB.prepare("UPDATE pn_admins SET estado = 'baja' WHERE pub = ?1").bind(String(q.pub)).run(); return json({ ok: true }); }
  return json({ error: 'no sé hacer eso' }, 400);
}

// ---------------- las imágenes y los videos ----------------
async function mediaGuardar(env, json, m, u, autor) {
  const parte = Math.floor(m.parte), partes = Math.floor(m.partes), tam = Math.floor(m.tam);
  if (!MIMES.test(m.mime) || !(partes >= 1 && partes <= Math.ceil(MEDIA_MAX / PARTE)) || !(parte >= 0 && parte < partes) || !(tam > 0 && tam <= MEDIA_MAX) || u.length > PARTE || !u.length) return json({ error: 'archivo inválido (imágenes o videos de hasta 24 MB)' }, 400);
  let id = String(m.id || '');
  if (parte === 0) {
    if (!autor.startsWith('admin:')) {   // (un tope por día para cada uno)
      const usado = await env.DB.prepare('SELECT SUM(tam) AS s FROM pn_media WHERE autor = ?1 AND parte = 0 AND creado > ?2').bind(autor, Date.now() - DIA).first();
      if (usado && usado.s + tam > MEDIA_DIA) return json({ error: 'subiste mucho hoy: probá mañana' }, 429);
    }
    id = azar(12);
  } else {
    const f = await env.DB.prepare('SELECT autor, partes, mime, tam FROM pn_media WHERE id = ?1 AND parte = 0').bind(id).first();
    if (!f || f.autor !== autor || f.partes !== partes || f.mime !== m.mime || f.tam !== tam) return json({ error: 'parte suelta' }, 400);
  }
  await env.DB.prepare('INSERT OR REPLACE INTO pn_media (id, parte, datos, mime, partes, tam, autor, creado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(id, parte, u, m.mime, partes, tam, autor, Date.now()).run();
  return json({ ok: true, id });
}
async function mediaDar(env, id) {
  const f = await env.DB.prepare('SELECT parte, datos, mime, partes FROM pn_media WHERE id = ?1 ORDER BY parte').bind(id).all();
  if (!f.results.length || f.results.length !== f.results[0].partes) return null;
  const L = f.results.map((x) => (x.datos instanceof Uint8Array ? x.datos : new Uint8Array(x.datos))), n = L.reduce((s, x) => s + x.length, 0), u = new Uint8Array(n);
  let o = 0; for (const x of L) { u.set(x, o); o += x.length; }
  return new Response(u, { headers: { 'Content-Type': f.results[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable', ...CORS } });
}

// ---------------- las rutas ----------------
export async function panelRutas(req, env, url, r, ip, json, cuentaUsuario, cuentaActiva) {
  if (!r.startsWith('/api/panel/')) return null;
  await tablas(env);
  const ahora = Date.now(); let m;
  // quien publica desde el juego: la cuenta de Google (si están encendidas) o el aparato
  const usuario = async () => { const u = cuentaUsuario ? await cuentaUsuario(req, env) : null; if (u) return { id: 'u:' + u.id, nombre: u.nombre }; return cuentaActiva && cuentaActiva(env) ? null : { id: 'ip:' + ip, nombre: '' }; };
  if (req.method === 'GET' && r === '/api/panel/posts') {
    const tipo = TIPOS_PUB.includes(url.searchParams.get('tipo')) ? url.searchParams.get('tipo') : 'bug', p = Math.max(0, Math.min(200, parseInt(url.searchParams.get('p'), 10) || 0));
    const orden = url.searchParams.get('orden') === 'pop' ? 'likes DESC, creado DESC' : 'creado DESC';
    const f = await env.DB.prepare(`SELECT * FROM pn_posts WHERE tipo = ?1 AND oculto = 0 AND privado = 0 ORDER BY ${orden} LIMIT 20 OFFSET ${p * 20}`).bind(tipo).all();
    return json({ posts: f.results.map((x) => postPublico(x, false)) });
  }
  if (req.method === 'GET' && (m = /^\/api\/panel\/post\/([a-z0-9]{8})$/.exec(r))) {
    const f = await env.DB.prepare('SELECT * FROM pn_posts WHERE id = ?1 AND oculto = 0 AND privado = 0').bind(m[1]).first();
    return f ? json({ post: postPublico(f, true) }) : json({ error: 'no existe' }, 404);
  }
  if (req.method === 'POST' && r === '/api/panel/post') {
    const u = await usuario(); if (!u) return json({ error: 'sin sesión', cuenta: true }, 401);
    const hora = await env.DB.prepare('SELECT COUNT(*) AS n FROM pn_posts WHERE autor = ?1 AND creado > ?2').bind(u.id, ahora - HORA).first();
    if (hora && hora.n >= 6) return json({ error: 'publicaste mucho: esperá un rato' }, 429);
    const d = await req.json().catch(() => ({}));
    const res = await postNuevo(env, d, u.id, u.nombre || d.nombre, ip, false); return json(res, res.error ? 400 : 200);
  }
  if (req.method === 'POST' && r === '/api/panel/media') {
    const u = await usuario(); if (!u) return json({ error: 'sin sesión', cuenta: true }, 401);
    const s = url.searchParams, buf = new Uint8Array(await req.arrayBuffer());
    return mediaGuardar(env, json, { id: s.get('id'), parte: +s.get('parte') || 0, partes: +s.get('partes') || 1, mime: s.get('mime') || '', tam: +s.get('tam') || 0 }, buf, u.id);
  }
  if (req.method === 'GET' && (m = /^\/api\/panel\/media\/([a-z0-9]{12})$/.exec(r))) return (await mediaDar(env, m[1])) || json({ error: 'no existe' }, 404);
  if (req.method === 'POST' && (m = /^\/api\/panel\/voto\/([a-z0-9]{8})$/.exec(r))) {
    const u = await usuario(); const quien0 = u ? u.id : 'ip:' + ip, k = (await req.json().catch(() => ({}))).k === 'denuncia' ? 'd' : 'l';
    const ya = await env.DB.prepare('SELECT 1 AS s FROM pn_votos WHERE post = ?1 AND quien = ?2 AND k = ?3').bind(m[1], quien0, k).first();
    if (!ya) {
      await env.DB.prepare('INSERT OR IGNORE INTO pn_votos (post, quien, k) VALUES (?1, ?2, ?3)').bind(m[1], quien0, k).run();
      if (k === 'l') await env.DB.prepare('UPDATE pn_posts SET likes = likes + 1 WHERE id = ?1').bind(m[1]).run();
      else await env.DB.prepare('UPDATE pn_posts SET denuncias = denuncias + 1, oculto = CASE WHEN denuncias + 1 >= 3 THEN 1 ELSE oculto END WHERE id = ?1').bind(m[1]).run();
    }
    return json({ ok: true });
  }
  if (req.method === 'POST' && r === '/api/panel/hola') {
    const b = await req.json().catch(() => ({})), d = String(b.d || '');
    if (!/^[a-z0-9]{16}$/.test(d)) return json({ error: 'aparato' }, 400);
    const ant = await env.DB.prepare('SELECT visto FROM pn_presencia WHERE d = ?1').bind(d).first();
    if (!ant || ahora - ant.visto > 8000) {   // (más seguido que cada 8 s, sólo se llevan las órdenes)
      await env.DB.prepare('INSERT INTO pn_presencia (d, nombre, version, plat, mapa, sala, visto, primero, ip) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8) ON CONFLICT(d) DO UPDATE SET nombre = ?2, version = ?3, plat = ?4, mapa = ?5, sala = ?6, visto = ?7, ip = ?8')
        .bind(d, linea(b.n, 24), linea(b.v, 16), linea(b.pl, 24), linea(b.m, 40), linea(b.s, 40), ahora, ip).run();
      for (const e of (Array.isArray(b.e) ? b.e : []).slice(0, 3)) {
        const msg = limpio(e, 600); if (msg.length < 3) continue; const h = (await sha(linea(b.v, 16) + '|' + msg)).slice(0, 24);
        await env.DB.prepare('INSERT INTO pn_errores (h, msg, version, n, aparatos, primero, ultimo) VALUES (?1, ?2, ?3, 1, 1, ?4, ?4) ON CONFLICT(h) DO UPDATE SET n = n + 1, ultimo = ?4').bind(h, msg, linea(b.v, 16), ahora).run();
      }
    }
    // las órdenes vigentes que este juego todavía no tiene (las más nuevas que la última que vio)
    const desde = Math.max(0, +b.u || 0);
    const o = await env.DB.prepare('SELECT id, a, f, c FROM pn_ordenes WHERE hasta > ?1 AND id > ?2 ORDER BY id ASC LIMIT 20').bind(ahora, desde).all();
    return json({ ahora, ordenes: o.results });
  }
  if (req.method === 'POST' && r === '/api/panel/solicitud') {
    const b = await req.json().catch(() => ({})), pub = String(b.pub || '');
    if (!/^[A-Za-z0-9+/=]{80,200}$/.test(pub)) return json({ error: 'llave' }, 400);
    try { await claveDe(pub); } catch (e) { return json({ error: 'llave' }, 400); }
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM pn_admins WHERE estado = 'pide' AND pedido > ?1").bind(ahora - DIA).first();
    if (n && n.n >= 20) return json({ error: 'muchos pedidos' }, 429);
    await env.DB.prepare("INSERT INTO pn_admins (pub, nombre, estado, pedido, ip) VALUES (?1, ?2, 'pide', ?3, ?4) ON CONFLICT(pub) DO UPDATE SET nombre = CASE WHEN estado = 'pide' THEN ?2 ELSE nombre END, pedido = ?3").bind(pub, linea(b.nombre, 30) || 'celular', ahora, ip).run();
    return json({ ok: true, codigo: (await sha(pub)).slice(0, 8) });
  }
  if (req.method === 'GET' && r === '/api/panel/cert') {
    const f = await env.DB.prepare("SELECT cert, estado FROM pn_admins WHERE pub = ?1").bind(String(url.searchParams.get('pub') || '')).first();
    return json({ estado: f ? f.estado : 'nada', cert: f && f.estado === 'ok' ? JSON.parse(f.cert) : null });
  }
  if (req.method === 'POST' && r === '/api/panel/admin') {
    const b = await req.json().catch(() => null), Q = await quien(env, b);
    if (!Q) return json({ error: 'sin permiso' }, 403);
    return admin(env, Q, ip, json);
  }
  return json({ error: 'no existe' }, 404);
}
