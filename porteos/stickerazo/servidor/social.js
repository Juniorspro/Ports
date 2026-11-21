// La zona social (publicaciones y amigos) y el chat de Stickerazo.
// Pensado para una comunidad de 13 años para arriba:
//  - Publicaciones: texto (con el mismo filtro de palabras que el resto) y hasta 4 imágenes, stickers o «videos» cortos
//    sin sonido (la app los convierte en un sticker animado, WebP). Me gusta y denuncias: con 3 denuncias se ocultan
//    solas hasta que las revisa la moderación (/api/admin/social).
//  - Amigos: se pide y el otro acepta. Bloquear corta la amistad y el chat.
//  - Chat: sólo entre amigos (nadie que no aceptaste te puede escribir), texto o stickers (pegatinas de la app o un
//    sticker tuyo); sin fotos de la galería. Cada mensaje se puede denunciar.
// Las rutas van debajo de /api/ (worker.js las llama con sus ayudas).
export const ESQUEMA_SOCIAL = [
  "CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, autor TEXT NOT NULL, texto TEXT NOT NULL DEFAULT '', media TEXT NOT NULL DEFAULT '[]', creado INTEGER NOT NULL, likes INTEGER NOT NULL DEFAULT 0, reportes INTEGER NOT NULL DEFAULT 0, oculto INTEGER NOT NULL DEFAULT 0)",
  'CREATE INDEX IF NOT EXISTS i_posts_creado ON posts(creado)',
  'CREATE INDEX IF NOT EXISTS i_posts_autor ON posts(autor, creado)',
  'CREATE TABLE IF NOT EXISTS post_likes (post TEXT NOT NULL, usuario TEXT NOT NULL, PRIMARY KEY (post, usuario))',
  'CREATE TABLE IF NOT EXISTS post_reportes (post TEXT NOT NULL, usuario TEXT NOT NULL, motivo TEXT NOT NULL, creado INTEGER NOT NULL, PRIMARY KEY (post, usuario))',
  'CREATE TABLE IF NOT EXISTS amigos (de TEXT NOT NULL, para TEXT NOT NULL, estado TEXT NOT NULL, creado INTEGER NOT NULL, PRIMARY KEY (de, para))',
  "CREATE TABLE IF NOT EXISTS mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, de TEXT NOT NULL, para TEXT NOT NULL, texto TEXT NOT NULL DEFAULT '', st TEXT, creado INTEGER NOT NULL, visto INTEGER NOT NULL DEFAULT 0, reportes INTEGER NOT NULL DEFAULT 0)",
  'CREATE INDEX IF NOT EXISTS i_mensajes_par ON mensajes(de, para, id)',
  'CREATE TABLE IF NOT EXISTS msg_reportes (msg INTEGER NOT NULL, usuario TEXT NOT NULL, motivo TEXT NOT NULL, creado INTEGER NOT NULL, PRIMARY KEY (msg, usuario))',
];
export const TABLAS_SOCIAL = 'posts|post_likes|post_reportes|amigos|mensajes|msg_reportes';
const MOTIVOS = ['ofensivo', 'sexual', 'violencia', 'acoso', 'spam', 'otro'];
const MAX_MEDIA = 4, PESO = { img: 450 * 1024, st: 150 * 1024, anim: 900 * 1024 }, LADO_MAX = 1600, POR_PAGINA = 20, OCULTAR_CON = 3;
const PEGA_ID = /^[a-zA-Z_]{2,20}$/;

/** ¿son amigos (los dos aceptaron)? */
export async function sonAmigos(db, a, b) {
  const r = await db.prepare("SELECT 1 FROM amigos WHERE ((de = ? AND para = ?) OR (de = ? AND para = ?)) AND estado = 'amigos'").bind(a, b, b, a).first();
  return !!r;
}
const bloqueo = (db, a, b) => db.prepare('SELECT 1 FROM bloqueos WHERE (usuario = ? AND bloqueado = ?) OR (usuario = ? AND bloqueado = ?)').bind(a, b, b, a).first();

/** al borrar una cuenta: sus publicaciones (con sus imágenes), sus me gusta, sus amigos y sus mensajes */
export async function socialAlBorrar(db, u, borrarArchivos) {
  const { results } = await db.prepare('SELECT id FROM posts WHERE autor = ?').bind(u).all();
  for (const p of results) await borrarArchivos('p_' + p.id);
  const { results: ms } = await db.prepare("SELECT st FROM mensajes WHERE (de = ? OR para = ?) AND st LIKE '%\"tipo\":\"mio\"%'").bind(u, u).all();
  for (const m of ms) { const k = claveSticker(m.st); if (k) await borrarArchivos('c_' + k); }
  const { results: lk } = await db.prepare('SELECT post FROM post_likes WHERE usuario = ?').bind(u).all();
  await db.batch([
    ...lk.map((x) => db.prepare('UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?').bind(x.post)),
    db.prepare('DELETE FROM post_likes WHERE usuario = ? OR post IN (SELECT id FROM posts WHERE autor = ?)').bind(u, u),
    db.prepare('DELETE FROM post_reportes WHERE usuario = ? OR post IN (SELECT id FROM posts WHERE autor = ?)').bind(u, u),
    db.prepare('DELETE FROM posts WHERE autor = ?').bind(u),
    db.prepare('DELETE FROM amigos WHERE de = ? OR para = ?').bind(u, u),
    db.prepare('DELETE FROM msg_reportes WHERE usuario = ? OR msg IN (SELECT id FROM mensajes WHERE de = ? OR para = ?)').bind(u, u, u),
    db.prepare('DELETE FROM mensajes WHERE de = ? OR para = ?').bind(u, u),
  ]);
}
/** al bloquear: se corta la amistad (y los pedidos) */
export const socialAlBloquear = (db, a, b) => db.prepare('DELETE FROM amigos WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)').bind(a, b, b, a).run();

// (los stickers propios del chat: en c/<clave al azar>/st.webp, así nadie los encuentra probando números)
const claveSticker = (st) => { try { const m = /^c\/([a-z0-9]{10})\/st\.webp$/.exec(JSON.parse(st || 'null').url || ''); return m ? m[1] : null; } catch (e) { return null; } };
const b64aBytes = (s) => { const t = atob(String(s || '')); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };

/** las rutas social/…, amigos…, chat…; devuelve la respuesta o null si no es de acá */
export async function socialRutas(req, env, db, yo, r, metodo, h) {
  if (!/^(social|amigos|chat)(\/|$)/.test(r)) return null;
  const { json, error, limite, cuerpo, textoProhibido, publico, guardarArchivo, borrarArchivos, infoWebP, nuevoId } = h;
  let m;
  const autorDe = (x) => ({ id: x.autor, nombre: x.a_nombre, avatar: publico({ id: x.autor, avatar: x.a_avatar }).avatar, premium: (x.a_premium || 0) > Date.now() });
  const postDe = (x, likeado) => ({ id: x.id, texto: x.texto, media: JSON.parse(x.media || '[]').map((md, i) => ({ tipo: md.tipo, url: `s/${x.id}/${i}.webp?v=${x.creado}`, w: md.w, h: md.h })),
    creado: x.creado, likes: x.likes, yoLike: !!likeado, autor: autorDe(x) });
  const SELECT_POST = 'SELECT p.*, u.nombre AS a_nombre, u.avatar AS a_avatar, u.premium_hasta AS a_premium FROM posts p JOIN usuarios u ON u.id = p.autor WHERE p.oculto = 0 AND u.bloqueado = 0';
  const conLikes = async (filas) => {
    if (!yo || !filas.length) return filas.map((x) => postDe(x, false));
    const { results } = await db.prepare(`SELECT post FROM post_likes WHERE usuario = ? AND post IN (${filas.map(() => '?').join(',')})`).bind(yo.id, ...filas.map((x) => x.id)).all();
    const s = new Set(results.map((x) => x.post)); return filas.map((x) => postDe(x, s.has(x.id)));
  };

  // ---------- publicaciones ----------
  if (r === 'social/feed' && metodo === 'GET') {
    const u = new URL(req.url), antes = Number(u.searchParams.get('antes')) || Date.now() + 1, modo = u.searchParams.get('modo') === 'amigos' ? 'amigos' : 'todos';
    if (modo === 'amigos' && !yo) return json({ posts: [], necesitaCuenta: true });
    let sql = SELECT_POST + ' AND p.creado < ?', args = [antes];
    if (yo) { sql += ' AND p.autor NOT IN (SELECT bloqueado FROM bloqueos WHERE usuario = ?) AND p.autor NOT IN (SELECT usuario FROM bloqueos WHERE bloqueado = ?)'; args.push(yo.id, yo.id); }
    if (modo === 'amigos') { sql += " AND (p.autor = ? OR p.autor IN (SELECT para FROM amigos WHERE de = ? AND estado = 'amigos') OR p.autor IN (SELECT de FROM amigos WHERE para = ? AND estado = 'amigos'))"; args.push(yo.id, yo.id, yo.id); }
    const { results } = await db.prepare(sql + ' ORDER BY p.creado DESC LIMIT ' + POR_PAGINA).bind(...args).all();
    return json({ posts: await conLikes(results), sigue: results.length === POR_PAGINA ? results[results.length - 1].creado : null });
  }
  if ((m = /^social\/usuario\/([a-z0-9]{10})$/.exec(r)) && metodo === 'GET') {
    if (yo && (await bloqueo(db, yo.id, m[1]))) return json({ posts: [] });
    const { results } = await db.prepare(SELECT_POST + ' AND p.autor = ? ORDER BY p.creado DESC LIMIT 30').bind(m[1]).all();
    return json({ posts: await conLikes(results) });
  }
  if (r === 'social/posts' && metodo === 'POST') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    if (!(await limite('post:' + yo.id, 12, 86400))) return error('Publicaste mucho hoy. Probá mañana.', 429);
    const d = await cuerpo(), texto = String(d.texto || '').trim().slice(0, 500), lista = Array.isArray(d.media) ? d.media.slice(0, MAX_MEDIA) : [];
    if (!texto && !lista.length) return error('Escribí algo o sumá una imagen');
    if (textoProhibido(texto)) return error('Esa publicación tiene palabras que no se pueden publicar');
    const archivos = [], media = [];
    for (const it of lista) {
      const tipo = ['img', 'st', 'anim'].includes(it.tipo) ? it.tipo : null; if (!tipo) return error('Mal armado');
      let b; try { b = b64aBytes(it.datos); } catch (e) { return error('Mal armado'); }
      const inf = infoWebP(b); if (!inf) return error('Las imágenes tienen que ser WebP');
      const w = inf.w || inf.ancho, hh = inf.h || inf.alto;
      if (b.length > PESO[tipo]) return error(tipo === 'anim' ? 'El video quedó muy pesado: probá uno más corto' : 'Una imagen pesa demasiado');
      if (w > LADO_MAX || hh > LADO_MAX) return error('Una imagen es muy grande');
      archivos.push(b); media.push({ tipo, w, h: hh });
    }
    const id = nuevoId(), ahora = Date.now();
    for (let i = 0; i < archivos.length; i++) await (await guardarArchivo('p_' + id, i + '.webp', 'image/webp', archivos[i])).run();
    await db.prepare('INSERT INTO posts (id, autor, texto, media, creado) VALUES (?, ?, ?, ?, ?)').bind(id, yo.id, texto, JSON.stringify(media), ahora).run();
    const x = await db.prepare(SELECT_POST.replace('WHERE p.oculto = 0 AND u.bloqueado = 0', 'WHERE p.id = ?')).bind(id).first();
    return json({ post: postDe(x, false) }, 201);
  }
  if ((m = /^social\/posts\/([a-z0-9]{10})$/.exec(r)) && metodo === 'DELETE') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const p = await db.prepare('SELECT autor FROM posts WHERE id = ?').bind(m[1]).first();
    if (!p) return error('No está', 404); if (p.autor !== yo.id) return error('No es tuya', 403);
    await borrarArchivos('p_' + m[1]);
    await db.batch([db.prepare('DELETE FROM post_likes WHERE post = ?').bind(m[1]), db.prepare('DELETE FROM post_reportes WHERE post = ?').bind(m[1]), db.prepare('DELETE FROM posts WHERE id = ?').bind(m[1])]);
    return json({ ok: true });
  }
  if ((m = /^social\/posts\/([a-z0-9]{10})\/(like|reportar)$/.exec(r)) && metodo === 'POST') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const p = await db.prepare('SELECT id, autor, likes, reportes FROM posts WHERE id = ? AND oculto = 0').bind(m[1]).first(); if (!p) return error('No está', 404);
    if (m[2] === 'like') {
      if (!(await limite('plike:' + yo.id, 300, 3600))) return error('Más despacio', 429);
      const ya = await db.prepare('SELECT 1 FROM post_likes WHERE post = ? AND usuario = ?').bind(p.id, yo.id).first();
      await db.batch(ya ? [db.prepare('DELETE FROM post_likes WHERE post = ? AND usuario = ?').bind(p.id, yo.id), db.prepare('UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?').bind(p.id)]
        : [db.prepare('INSERT INTO post_likes (post, usuario) VALUES (?, ?)').bind(p.id, yo.id), db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').bind(p.id)]);
      const n = await db.prepare('SELECT likes FROM posts WHERE id = ?').bind(p.id).first();
      return json({ yoLike: !ya, likes: n.likes });
    }
    if (p.autor === yo.id) return error('Es tuya');
    if (!(await limite('preporte:' + yo.id, 30, 86400))) return error('Probá mañana', 429);
    const d = await cuerpo(), motivo = MOTIVOS.includes(d.motivo) ? d.motivo : 'otro';
    const nuevo = await db.prepare('INSERT OR IGNORE INTO post_reportes (post, usuario, motivo, creado) VALUES (?, ?, ?, ?)').bind(p.id, yo.id, motivo, Date.now()).run();
    if (nuevo.meta && nuevo.meta.changes) await db.prepare(`UPDATE posts SET reportes = reportes + 1, oculto = CASE WHEN reportes + 1 >= ${OCULTAR_CON} THEN 1 ELSE oculto END WHERE id = ?`).bind(p.id).run();
    return json({ ok: true });
  }

  // ---------- amigos ----------
  if (r === 'amigos' && metodo === 'GET') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const { results } = await db.prepare(`SELECT a.de, a.para, a.estado, a.creado, u.id, u.nombre, u.avatar, u.premium_hasta FROM amigos a JOIN usuarios u ON u.id = CASE WHEN a.de = ? THEN a.para ELSE a.de END
      WHERE (a.de = ? OR a.para = ?) AND u.bloqueado = 0 ORDER BY a.creado DESC LIMIT 500`).bind(yo.id, yo.id, yo.id).all();
    const persona = (x) => ({ ...publico(x), desde: x.creado });
    return json({ amigos: results.filter((x) => x.estado === 'amigos').map(persona), pedidos: results.filter((x) => x.estado === 'pedido' && x.para === yo.id).map(persona),
      enviados: results.filter((x) => x.estado === 'pedido' && x.de === yo.id).map(persona) });
  }
  if ((m = /^amigos\/([a-z0-9]{10})$/.exec(r)) && (metodo === 'POST' || metodo === 'DELETE')) {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const otro = m[1]; if (otro === yo.id) return error('Sos vos');
    if (metodo === 'DELETE') { await db.prepare('DELETE FROM amigos WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)').bind(yo.id, otro, otro, yo.id).run(); return json({ estado: 'nada' }); }
    const u = await db.prepare('SELECT id FROM usuarios WHERE id = ? AND bloqueado = 0').bind(otro).first(); if (!u) return error('No está', 404);
    if (await bloqueo(db, yo.id, otro)) return error('No se puede', 403);
    const suyo = await db.prepare('SELECT estado FROM amigos WHERE de = ? AND para = ?').bind(otro, yo.id).first();
    if (suyo) { await db.prepare("UPDATE amigos SET estado = 'amigos' WHERE de = ? AND para = ?").bind(otro, yo.id).run(); return json({ estado: 'amigos' }); }   // (te lo había pedido: aceptar)
    const mio = await db.prepare('SELECT estado FROM amigos WHERE de = ? AND para = ?').bind(yo.id, otro).first(); if (mio) return json({ estado: mio.estado === 'amigos' ? 'amigos' : 'enviado' });
    if (!(await limite('amigo:' + yo.id, 40, 86400))) return error('Mandaste muchos pedidos hoy', 429);
    await db.prepare("INSERT INTO amigos (de, para, estado, creado) VALUES (?, ?, 'pedido', ?)").bind(yo.id, otro, Date.now()).run();
    return json({ estado: 'enviado' });
  }

  // ---------- chat (sólo entre amigos) ----------
  if (r === 'chat' && metodo === 'GET') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const { results } = await db.prepare(`SELECT u.id, u.nombre, u.avatar, u.premium_hasta,
        (SELECT m.texto FROM mensajes m WHERE (m.de = u.id AND m.para = ?1) OR (m.de = ?1 AND m.para = u.id) ORDER BY m.id DESC LIMIT 1) AS ult_texto,
        (SELECT m.st FROM mensajes m WHERE (m.de = u.id AND m.para = ?1) OR (m.de = ?1 AND m.para = u.id) ORDER BY m.id DESC LIMIT 1) AS ult_st,
        (SELECT m.creado FROM mensajes m WHERE (m.de = u.id AND m.para = ?1) OR (m.de = ?1 AND m.para = u.id) ORDER BY m.id DESC LIMIT 1) AS ult_cuando,
        (SELECT COUNT(*) FROM mensajes m WHERE m.de = u.id AND m.para = ?1 AND m.visto = 0) AS sin_leer
      FROM amigos a JOIN usuarios u ON u.id = CASE WHEN a.de = ?1 THEN a.para ELSE a.de END
      WHERE (a.de = ?1 OR a.para = ?1) AND a.estado = 'amigos' AND u.bloqueado = 0 ORDER BY COALESCE(ult_cuando, 0) DESC, u.nombre LIMIT 300`).bind(yo.id).all();
    return json({ chats: results.map((x) => ({ ...publico(x), ultimo: x.ult_cuando ? { texto: x.ult_texto, st: !!x.ult_st, cuando: x.ult_cuando } : null, sinLeer: x.sin_leer })) });
  }
  if (r === 'chat/novedades' && metodo === 'GET') {
    if (!yo) return json({ mensajes: 0, pedidos: 0 });
    const a = await db.prepare('SELECT COUNT(*) AS n FROM mensajes WHERE para = ? AND visto = 0').bind(yo.id).first(), b = await db.prepare("SELECT COUNT(*) AS n FROM amigos WHERE para = ? AND estado = 'pedido'").bind(yo.id).first();
    return json({ mensajes: a.n, pedidos: b.n });
  }
  if ((m = /^chat\/([a-z0-9]{10})$/.exec(r)) && (metodo === 'GET' || metodo === 'POST')) {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const otro = m[1];
    if (!(await sonAmigos(db, yo.id, otro)) || (await bloqueo(db, yo.id, otro))) return error('Sólo podés chatear con tus amigos', 403);
    if (metodo === 'GET') {
      const desde = Number(new URL(req.url).searchParams.get('desde')) || 0;
      const { results } = await db.prepare(`SELECT id, de, texto, st, creado FROM mensajes WHERE ((de = ? AND para = ?) OR (de = ? AND para = ?)) AND id > ? ORDER BY id ${desde ? 'ASC' : 'DESC'} LIMIT 60`).bind(yo.id, otro, otro, yo.id, desde).all();
      const lista = desde ? results : results.reverse();
      await db.prepare('UPDATE mensajes SET visto = 1 WHERE de = ? AND para = ? AND visto = 0').bind(otro, yo.id).run();
      return json({ mensajes: lista.map((x) => ({ id: x.id, mio: x.de === yo.id, texto: x.texto, st: x.st ? JSON.parse(x.st) : null, creado: x.creado })) });
    }
    if (!(await limite('msg:' + yo.id, 40, 60))) return error('Más despacio', 429);
    const d = await cuerpo(), texto = String(d.texto || '').trim().slice(0, 500); let st = null, archivo = null;
    if (d.st && d.st.tipo === 'pega' && PEGA_ID.test(d.st.id || '')) st = { tipo: 'pega', id: d.st.id };
    else if (d.st && d.st.tipo === 'pack' && /^m\/[a-z0-9]{10}\/[A-Za-z0-9_-]{1,40}\.webp$/.test(d.st.url || '')) st = { tipo: 'pack', url: d.st.url };
    else if (d.st && d.st.tipo === 'mio') {
      let b; try { b = b64aBytes(d.st.datos); } catch (e) { return error('Mal armado'); }
      const inf = infoWebP(b); if (!inf || b.length > PESO.st || (inf.w || inf.ancho) > 512 || (inf.h || inf.alto) > 512) return error('Ese sticker no se puede mandar');
      archivo = b; st = { tipo: 'mio' };
    }
    if (!texto && !st) return error('Escribí algo');
    if (texto && textoProhibido(texto)) return error('Ese mensaje tiene palabras que no se pueden mandar');
    const res = await db.prepare('INSERT INTO mensajes (de, para, texto, st, creado) VALUES (?, ?, ?, ?, ?)').bind(yo.id, otro, texto, st ? JSON.stringify(st) : null, Date.now()).run();
    const id = res.meta && res.meta.last_row_id;
    if (archivo) { const k = nuevoId(); await (await guardarArchivo('c_' + k, 'st.webp', 'image/webp', archivo)).run(); st = { tipo: 'mio', url: `c/${k}/st.webp` }; await db.prepare('UPDATE mensajes SET st = ? WHERE id = ?').bind(JSON.stringify(st), id).run(); }
    return json({ mensaje: { id, mio: true, texto, st, creado: Date.now() } }, 201);
  }
  if ((m = /^chat\/mensaje\/(\d{1,12})\/reportar$/.exec(r)) && metodo === 'POST') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const msg = await db.prepare('SELECT id, de, para FROM mensajes WHERE id = ?').bind(Number(m[1])).first();
    if (!msg || msg.para !== yo.id) return error('No está', 404);
    const d = await cuerpo(), motivo = MOTIVOS.includes(d.motivo) ? d.motivo : 'otro';
    const nuevo = await db.prepare('INSERT OR IGNORE INTO msg_reportes (msg, usuario, motivo, creado) VALUES (?, ?, ?, ?)').bind(msg.id, yo.id, motivo, Date.now()).run();
    if (nuevo.meta && nuevo.meta.changes) await db.prepare('UPDATE mensajes SET reportes = reportes + 1 WHERE id = ?').bind(msg.id).run();
    return json({ ok: true });
  }
  return error('No existe', 404);
}

/** lo que ve la moderación: publicaciones y mensajes denunciados */
export async function socialAdmin(db, r, metodo, d, { json, error, borrarArchivos }) {
  if (r === 'admin/social' && metodo === 'GET') {
    const { results: posts } = await db.prepare(`SELECT p.id, p.texto, p.media, p.reportes, p.oculto, p.creado, u.nombre, (SELECT GROUP_CONCAT(motivo) FROM post_reportes WHERE post = p.id) AS motivos
      FROM posts p JOIN usuarios u ON u.id = p.autor WHERE p.reportes > 0 ORDER BY p.oculto DESC, p.reportes DESC LIMIT 100`).all();
    const { results: mensajes } = await db.prepare(`SELECT m.id, m.texto, m.st, m.reportes, m.creado, a.nombre AS de, b.nombre AS para, (SELECT GROUP_CONCAT(motivo) FROM msg_reportes WHERE msg = m.id) AS motivos
      FROM mensajes m JOIN usuarios a ON a.id = m.de JOIN usuarios b ON b.id = m.para WHERE m.reportes > 0 ORDER BY m.id DESC LIMIT 100`).all();
    return json({ posts: posts.map((x) => ({ ...x, media: JSON.parse(x.media || '[]').map((_, i) => `s/${x.id}/${i}.webp`) })), mensajes });
  }
  if (r === 'admin/social' && metodo === 'POST') {
    if (d.post && /^[a-z0-9]{10}$/.test(d.post)) {
      if (d.accion === 'borrar') { await borrarArchivos('p_' + d.post); await db.batch([db.prepare('DELETE FROM post_likes WHERE post = ?').bind(d.post), db.prepare('DELETE FROM post_reportes WHERE post = ?').bind(d.post), db.prepare('DELETE FROM posts WHERE id = ?').bind(d.post)]); }
      else if (d.accion === 'mostrar') await db.batch([db.prepare('UPDATE posts SET oculto = 0, reportes = 0 WHERE id = ?').bind(d.post), db.prepare('DELETE FROM post_reportes WHERE post = ?').bind(d.post)]);
      return json({ ok: true });
    }
    if (Number.isInteger(d.mensaje)) {
      if (d.accion === 'borrar') { const x = await db.prepare('SELECT st FROM mensajes WHERE id = ?').bind(d.mensaje).first(), k = x && claveSticker(x.st); if (k) await borrarArchivos('c_' + k); await db.batch([db.prepare('DELETE FROM msg_reportes WHERE msg = ?').bind(d.mensaje), db.prepare('DELETE FROM mensajes WHERE id = ?').bind(d.mensaje)]); }
      else await db.batch([db.prepare('UPDATE mensajes SET reportes = 0 WHERE id = ?').bind(d.mensaje), db.prepare('DELETE FROM msg_reportes WHERE msg = ?').bind(d.mensaje)]);
      return json({ ok: true });
    }
    return error('Mal armado');
  }
  return null;
}
