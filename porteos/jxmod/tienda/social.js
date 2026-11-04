// ---------------- social de JXMod: perfil con ID, amigos, chats y grupos, invitaciones a partida ----------------
// Todo con la sesión de Google (cuenta.js). Cada cuenta tiene un perfil con un ID público de 8 números (lo que se
// comparte para agregarse), su nombre, su personaje y si quiere aparecer en línea. "En línea" = mandó un latido hace
// menos de 70 s (el juego late cada 30 s, con el server en el que está). Amigos: solicitud → aceptar (o rechazar);
// bloquear corta todo (ni solicitudes ni mensajes). Chats: de a dos (sólo entre amigos) y grupos (los arma uno con sus
// amigos); los mensajes quedan en D1 (los últimos 200 por chat), con un tope de 30 por minuto por persona; las
// invitaciones a partida son un mensaje con el server (id, nombre, mapa). El texto lo filtra el juego antes de mandarlo
// (censura local) y acá se limpian los caracteres de control y se recorta.
const ENLINEA = 70e3, MAX_TXT = 500;
const limpiar = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const azarHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const SKIN_RE = /^[\w:./ -]{1,160}$/;
let listas = false;
async function tablas(env) {
  if (listas) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS perfiles (usuario TEXT PRIMARY KEY, pid TEXT UNIQUE, nombre TEXT, skin TEXT, estado TEXT, visto INTEGER, sala TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS amigos (de TEXT, a TEXT, estado TEXT, fecha INTEGER, PRIMARY KEY (de, a))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_amigos_a ON amigos(a, estado)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, tipo TEXT, nombre TEXT, dueno TEXT, creado INTEGER, clave TEXT UNIQUE)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS chat_miembros (chat TEXT, usuario TEXT, leido INTEGER DEFAULT 0, escribe INTEGER DEFAULT 0, PRIMARY KEY (chat, usuario))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_cm_usuario ON chat_miembros(usuario)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, chat TEXT, de TEXT, texto TEXT, tipo TEXT, datos TEXT, fecha INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_msg_chat ON mensajes(chat, id)'),
  ]);
  listas = true;
}
async function perfilDe(env, u) {
  let p = await env.DB.prepare('SELECT * FROM perfiles WHERE usuario = ?1').bind(u.id).first();
  if (p) return p;
  for (let i = 0; i < 6 && !p; i++) {
    const pid = String(10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000));
    try { await env.DB.prepare('INSERT INTO perfiles (usuario, pid, nombre, skin, estado, visto, sala) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(u.id, pid, limpiar(u.nombre || 'Jugador', 24), 'Hero', 'on', Date.now(), '').run(); p = await env.DB.prepare('SELECT * FROM perfiles WHERE usuario = ?1').bind(u.id).first(); } catch (e) { p = null; }
  }
  return p;
}
const enLinea = (p, ahora) => !!p && p.estado !== 'off' && ahora - (p.visto || 0) < ENLINEA;
const publico = (p, ahora, mio) => p && { pid: p.pid, nombre: p.nombre, skin: p.skin, online: enLinea(p, ahora), visto: p.estado === 'off' && !mio ? 0 : p.visto || 0, sala: enLinea(p, ahora) && p.sala ? JSON.parse(p.sala) : null };
async function relacion(env, a, b) {
  const r = await env.DB.prepare('SELECT de, a, estado FROM amigos WHERE (de = ?1 AND a = ?2) OR (de = ?2 AND a = ?1)').bind(a, b).all();
  const o = { amigos: false, pedi: false, mePidio: false, bloquee: false, meBloqueo: false };
  for (const x of r.results) {
    if (x.estado === 'ok') o.amigos = true;
    if (x.estado === 'pend') { if (x.de === a) o.pedi = true; else o.mePidio = true; }
    if (x.estado === 'bloq') { if (x.de === a) o.bloquee = true; else o.meBloqueo = true; }
  }
  return o;
}
async function esMiembro(env, chat, u) { return !!(await env.DB.prepare('SELECT 1 AS s FROM chat_miembros WHERE chat = ?1 AND usuario = ?2').bind(chat, u).first()); }
async function ponerMensaje(env, chat, de, texto, tipo, datos) {
  const ahora = Date.now();
  await env.DB.prepare('INSERT INTO mensajes (chat, de, texto, tipo, datos, fecha) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(chat, de, texto, tipo, datos ? JSON.stringify(datos) : '', ahora).run();
  // (sólo los últimos 200 por chat)
  await env.DB.prepare('DELETE FROM mensajes WHERE chat = ?1 AND id < (SELECT MIN(id) FROM (SELECT id FROM mensajes WHERE chat = ?1 ORDER BY id DESC LIMIT 200))').bind(chat).run();
}
const salaLimpia = (s) => s && typeof s === 'object' && /^[a-z0-9]{3,20}$/i.test(s.id || '') ? { id: String(s.id), n: limpiar(s.n, 30), m: limpiar(s.m, 40), mods: Math.max(0, Math.min(999, s.mods | 0)) } : null;

// las rutas /api/social/...: la respuesta, o null si no es de acá
export async function socialRutas(req, env, url, r, json, cuentaUsuario) {
  if (!r.startsWith('/api/social')) return null;
  const u = await cuentaUsuario(req, env); if (!u) return json({ error: 'sin sesión', cuenta: true }, 401);
  await tablas(env);
  const ahora = Date.now(), yo = await perfilDe(env, u); if (!yo) return json({ error: 'sin perfil' }, 500);
  const cuerpo = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const otroPorPid = async (pid) => (/^\d{8}$/.test(String(pid || '')) ? env.DB.prepare('SELECT * FROM perfiles WHERE pid = ?1').bind(String(pid)).first() : null);
  let m;
  if (r === '/api/social/yo') return json({ perfil: publico(yo, ahora, true), estado: yo.estado });
  if (req.method === 'POST' && r === '/api/social/perfil') {
    const nombre = cuerpo.nombre !== undefined ? limpiar(cuerpo.nombre, 24) || yo.nombre : yo.nombre, skin = SKIN_RE.test(cuerpo.skin || '') ? cuerpo.skin : yo.skin, estado = cuerpo.estado === 'off' ? 'off' : cuerpo.estado === 'on' ? 'on' : yo.estado;
    await env.DB.prepare('UPDATE perfiles SET nombre = ?2, skin = ?3, estado = ?4 WHERE usuario = ?1').bind(u.id, nombre, skin, estado).run();
    return json({ ok: true, perfil: publico({ ...yo, nombre, skin, estado }, ahora, true) });
  }
  // el latido: estoy acá (y en qué server); devuelve lo nuevo para el globito del menú
  if (req.method === 'POST' && r === '/api/social/latido') {
    const sala = salaLimpia(cuerpo.sala);
    await env.DB.prepare('UPDATE perfiles SET visto = ?2, sala = ?3' + (SKIN_RE.test(cuerpo.skin || '') ? ', skin = ?4' : '') + ' WHERE usuario = ?1').bind(u.id, ahora, sala ? JSON.stringify(sala) : '', ...(SKIN_RE.test(cuerpo.skin || '') ? [cuerpo.skin] : [])).run();
    const sol = await env.DB.prepare("SELECT COUNT(*) AS n FROM amigos WHERE a = ?1 AND estado = 'pend'").bind(u.id).first();
    const nl = await env.DB.prepare('SELECT COUNT(*) AS n FROM mensajes m JOIN chat_miembros c ON c.chat = m.chat AND c.usuario = ?1 WHERE m.id > c.leido AND m.de != ?1').bind(u.id).first();
    const ult = await env.DB.prepare('SELECT m.id, m.chat, m.texto, m.tipo, m.datos, p.nombre FROM mensajes m JOIN chat_miembros c ON c.chat = m.chat AND c.usuario = ?1 LEFT JOIN perfiles p ON p.usuario = m.de WHERE m.id > c.leido AND m.de != ?1 ORDER BY m.id DESC LIMIT 1').bind(u.id).first();
    if (ult) { ult.k = ult.tipo === 'sis' && ult.datos ? JSON.parse(ult.datos).k : undefined; delete ult.datos; }
    return json({ solicitudes: sol ? sol.n : 0, noLeidos: nl ? nl.n : 0, ultimo: ult || null });
  }
  if (req.method === 'GET' && r === '/api/social/buscar') {
    const p = await otroPorPid(url.searchParams.get('pid')); if (!p || p.usuario === u.id) return json({ error: 'no existe' }, 404);
    const rel = await relacion(env, u.id, p.usuario); if (rel.meBloqueo) return json({ error: 'no existe' }, 404);
    return json({ perfil: publico(p, ahora), rel });
  }
  if (req.method === 'POST' && r === '/api/social/amigo') {
    const p = await otroPorPid(cuerpo.pid); if (!p || p.usuario === u.id) return json({ error: 'no existe' }, 404);
    const rel = await relacion(env, u.id, p.usuario), acc = cuerpo.accion;
    if (rel.meBloqueo && acc !== 'bloquear') return json({ error: 'no existe' }, 404);
    if (acc === 'pedir') {
      if (rel.bloquee || rel.amigos) return json({ ok: true, rel });
      if (rel.mePidio) { await env.DB.batch([env.DB.prepare("INSERT OR REPLACE INTO amigos (de, a, estado, fecha) VALUES (?1, ?2, 'ok', ?3)").bind(u.id, p.usuario, ahora), env.DB.prepare("INSERT OR REPLACE INTO amigos (de, a, estado, fecha) VALUES (?2, ?1, 'ok', ?3)").bind(u.id, p.usuario, ahora)]); }
      else { const h = await env.DB.prepare("SELECT COUNT(*) AS n FROM amigos WHERE de = ?1 AND estado = 'pend' AND fecha > ?2").bind(u.id, ahora - 3600e3).first(); if (h && h.n >= 30) return json({ error: 'muchas solicitudes: esperá un rato' }, 429);
        await env.DB.prepare("INSERT OR REPLACE INTO amigos (de, a, estado, fecha) VALUES (?1, ?2, 'pend', ?3)").bind(u.id, p.usuario, ahora).run(); }
    } else if (acc === 'aceptar') {
      if (!rel.mePidio) return json({ error: 'sin solicitud' }, 400);
      await env.DB.batch([env.DB.prepare("INSERT OR REPLACE INTO amigos (de, a, estado, fecha) VALUES (?1, ?2, 'ok', ?3)").bind(u.id, p.usuario, ahora), env.DB.prepare("INSERT OR REPLACE INTO amigos (de, a, estado, fecha) VALUES (?2, ?1, 'ok', ?3)").bind(u.id, p.usuario, ahora)]);
    } else if (acc === 'rechazar' || acc === 'borrar' || acc === 'desbloquear') {
      await env.DB.prepare(acc === 'desbloquear' ? "DELETE FROM amigos WHERE de = ?1 AND a = ?2 AND estado = 'bloq'" : "DELETE FROM amigos WHERE ((de = ?1 AND a = ?2) OR (de = ?2 AND a = ?1)) AND estado != 'bloq'").bind(u.id, p.usuario).run();
    } else if (acc === 'bloquear') {
      await env.DB.batch([env.DB.prepare("DELETE FROM amigos WHERE (de = ?1 AND a = ?2) OR (de = ?2 AND a = ?1 AND estado != 'bloq')").bind(u.id, p.usuario), env.DB.prepare("INSERT OR REPLACE INTO amigos (de, a, estado, fecha) VALUES (?1, ?2, 'bloq', ?3)").bind(u.id, p.usuario, ahora)]);
    } else return json({ error: 'acción inválida' }, 400);
    return json({ ok: true, rel: await relacion(env, u.id, p.usuario) });
  }
  if (req.method === 'GET' && r === '/api/social/amigos') {
    const f = await env.DB.prepare('SELECT p.*, a.de AS rde, a.estado AS rel FROM amigos a JOIN perfiles p ON p.usuario = (CASE WHEN a.de = ?1 THEN a.a ELSE a.de END) WHERE a.de = ?1 OR (a.a = ?1 AND a.estado = \'pend\')').bind(u.id).all();
    const o = { amigos: [], recibidas: [], enviadas: [], bloqueados: [] };
    for (const x of f.results) {
      const p = publico(x, ahora);
      if (x.rel === 'ok' && x.rde === u.id) o.amigos.push(p);
      else if (x.rel === 'pend') (x.rde === u.id ? o.enviadas : o.recibidas).push(p);
      else if (x.rel === 'bloq' && x.rde === u.id) o.bloqueados.push({ pid: p.pid, nombre: p.nombre, skin: p.skin });
    }
    o.amigos.sort((a, b) => (b.online - a.online) || (b.visto - a.visto));
    return json(o);
  }
  // ---- chats ----
  if (req.method === 'GET' && r === '/api/social/chats') {
    const f = await env.DB.prepare('SELECT c.id, c.tipo, c.nombre, cm.leido, (SELECT COUNT(*) FROM chat_miembros x WHERE x.chat = c.id) AS n FROM chats c JOIN chat_miembros cm ON cm.chat = c.id AND cm.usuario = ?1').bind(u.id).all();
    const out = [];
    for (const c of f.results) {
      const ult = await env.DB.prepare('SELECT m.texto, m.tipo, m.datos, m.fecha, p.nombre FROM mensajes m LEFT JOIN perfiles p ON p.usuario = m.de WHERE m.chat = ?1 ORDER BY m.id DESC LIMIT 1').bind(c.id).first();
      const nl = await env.DB.prepare('SELECT COUNT(*) AS n FROM mensajes WHERE chat = ?1 AND id > ?2 AND de != ?3').bind(c.id, c.leido || 0, u.id).first();
      let otro = null; if (c.tipo === 'dm') { const p = await env.DB.prepare('SELECT p.* FROM chat_miembros m JOIN perfiles p ON p.usuario = m.usuario WHERE m.chat = ?1 AND m.usuario != ?2').bind(c.id, u.id).first(); otro = publico(p, ahora); }
      const enl = c.tipo === 'grupo' ? await env.DB.prepare('SELECT COUNT(*) AS n FROM chat_miembros m JOIN perfiles p ON p.usuario = m.usuario WHERE m.chat = ?1 AND p.estado != \'off\' AND p.visto > ?2').bind(c.id, ahora - ENLINEA).first() : null;
      out.push({ id: c.id, tipo: c.tipo, nombre: c.tipo === 'dm' ? (otro && otro.nombre) || '?' : c.nombre, miembros: c.n, enLinea: enl ? enl.n : undefined, otro, ultimo: ult ? { texto: ult.tipo === 'inv' ? '' : ult.texto, tipo: ult.tipo, k: ult.tipo === 'sis' && ult.datos ? JSON.parse(ult.datos).k : undefined, de: ult.nombre, fecha: ult.fecha } : null, noLeidos: nl ? nl.n : 0 });
    }
    out.sort((a, b) => ((b.ultimo && b.ultimo.fecha) || 0) - ((a.ultimo && a.ultimo.fecha) || 0));
    return json({ chats: out });
  }
  if (req.method === 'POST' && r === '/api/social/chat') {
    const p = await otroPorPid(cuerpo.pid); if (!p) return json({ error: 'no existe' }, 404);
    const rel = await relacion(env, u.id, p.usuario); if (!rel.amigos) return json({ error: 'sólo con amigos' }, 403);
    const clave = [u.id, p.usuario].sort().join(':');
    let c = await env.DB.prepare('SELECT id FROM chats WHERE clave = ?1').bind(clave).first();
    if (!c) { const id = azarHex(8); await env.DB.batch([env.DB.prepare("INSERT INTO chats (id, tipo, nombre, dueno, creado, clave) VALUES (?1, 'dm', '', ?2, ?3, ?4)").bind(id, u.id, ahora, clave), env.DB.prepare('INSERT INTO chat_miembros (chat, usuario) VALUES (?1, ?2)').bind(id, u.id), env.DB.prepare('INSERT INTO chat_miembros (chat, usuario) VALUES (?1, ?2)').bind(id, p.usuario)]); c = { id }; }
    return json({ id: c.id });
  }
  if (req.method === 'POST' && r === '/api/social/grupo') {
    const nombre = limpiar(cuerpo.nombre, 30); if (nombre.length < 2) return json({ error: 'falta el nombre' }, 400);
    const id = azarHex(8), ops = [env.DB.prepare("INSERT INTO chats (id, tipo, nombre, dueno, creado, clave) VALUES (?1, 'grupo', ?2, ?3, ?4, NULL)").bind(id, nombre, u.id, ahora), env.DB.prepare('INSERT INTO chat_miembros (chat, usuario) VALUES (?1, ?2)').bind(id, u.id)];
    for (const pid of (Array.isArray(cuerpo.pids) ? cuerpo.pids : []).slice(0, 30)) { const p = await otroPorPid(pid); if (p && (await relacion(env, u.id, p.usuario)).amigos) ops.push(env.DB.prepare('INSERT OR IGNORE INTO chat_miembros (chat, usuario) VALUES (?1, ?2)').bind(id, p.usuario)); }
    await env.DB.batch(ops); await ponerMensaje(env, id, u.id, yo.nombre, 'sis', { k: 'creo' });
    return json({ id });
  }
  if ((m = /^\/api\/social\/chat\/([a-f0-9]{16})(\/[a-z]+)?$/.exec(r))) {
    const chat = m[1], sub = m[2] || ''; if (!(await esMiembro(env, chat, u.id))) return json({ error: 'no sos del chat' }, 403);
    const C = await env.DB.prepare('SELECT * FROM chats WHERE id = ?1').bind(chat).first();
    if (req.method === 'GET' && !sub) {
      const desde = Math.max(0, +url.searchParams.get('desde') || 0);
      const f = await env.DB.prepare('SELECT m.id, m.texto, m.tipo, m.datos, m.fecha, p.pid, p.nombre, p.skin, m.de = ?3 AS mio FROM mensajes m LEFT JOIN perfiles p ON p.usuario = m.de WHERE m.chat = ?1 AND m.id > ?2 ORDER BY m.id DESC LIMIT 60').bind(chat, desde, u.id).all();
      const L = f.results.reverse().map((x) => ({ id: x.id, texto: x.texto, tipo: x.tipo, datos: x.datos ? JSON.parse(x.datos) : null, fecha: x.fecha, de: { pid: x.pid, nombre: x.nombre, skin: x.skin }, mio: !!x.mio }));
      if (L.length) await env.DB.prepare('UPDATE chat_miembros SET leido = MAX(leido, ?3) WHERE chat = ?1 AND usuario = ?2').bind(chat, u.id, L[L.length - 1].id).run();
      const esc = await env.DB.prepare('SELECT p.nombre FROM chat_miembros m JOIN perfiles p ON p.usuario = m.usuario WHERE m.chat = ?1 AND m.usuario != ?2 AND m.escribe > ?3').bind(chat, u.id, ahora - 5000).all();
      // (cuánto leyeron los demás: para los dos tildes)
      const lei = await env.DB.prepare('SELECT MIN(leido) AS l FROM chat_miembros WHERE chat = ?1 AND usuario != ?2').bind(chat, u.id).first();
      return json({ mensajes: L, escribiendo: esc.results.map((x) => x.nombre), leidoHasta: lei ? lei.l || 0 : 0, chat: { id: chat, tipo: C.tipo, nombre: C.nombre, dueno: C.dueno === u.id } });
    }
    if (req.method === 'GET' && sub === '/miembros') {
      const f = await env.DB.prepare('SELECT p.* FROM chat_miembros m JOIN perfiles p ON p.usuario = m.usuario WHERE m.chat = ?1').bind(chat).all();
      return json({ miembros: f.results.map((p) => publico(p, ahora)) });
    }
    if (req.method === 'POST' && sub === '/escribe') { await env.DB.prepare('UPDATE chat_miembros SET escribe = ?3 WHERE chat = ?1 AND usuario = ?2').bind(chat, u.id, ahora).run(); return json({ ok: true }); }
    if (req.method === 'POST' && sub === '/enviar') {
      const min = await env.DB.prepare('SELECT COUNT(*) AS n FROM mensajes WHERE de = ?1 AND fecha > ?2').bind(u.id, ahora - 60e3).first(); if (min && min.n >= 30) return json({ error: 'muchos mensajes: esperá un poco' }, 429);
      if (C.tipo === 'dm') { const o = await env.DB.prepare('SELECT usuario FROM chat_miembros WHERE chat = ?1 AND usuario != ?2').bind(chat, u.id).first(); if (o && !(await relacion(env, u.id, o.usuario)).amigos) return json({ error: 'ya no son amigos' }, 403); }
      const inv = salaLimpia(cuerpo.inv), texto = limpiar(cuerpo.texto, MAX_TXT);
      if (!inv && !texto) return json({ error: 'vacío' }, 400);
      await ponerMensaje(env, chat, u.id, texto, inv ? 'inv' : 't', inv);
      await env.DB.prepare('UPDATE chat_miembros SET escribe = 0 WHERE chat = ?1 AND usuario = ?2').bind(chat, u.id).run();
      return json({ ok: true });
    }
    if (req.method === 'POST' && sub === '/invitar' && C.tipo === 'grupo') {
      const ops = []; let n = 0;
      for (const pid of (Array.isArray(cuerpo.pids) ? cuerpo.pids : []).slice(0, 30)) { const p = await otroPorPid(pid); if (p && (await relacion(env, u.id, p.usuario)).amigos) { ops.push(env.DB.prepare('INSERT OR IGNORE INTO chat_miembros (chat, usuario) VALUES (?1, ?2)').bind(chat, p.usuario)); n++; await ponerMensaje(env, chat, u.id, p.nombre, 'sis', { k: 'unio' }); } }
      if (ops.length) await env.DB.batch(ops); return json({ ok: true, agregados: n });
    }
    if (req.method === 'POST' && sub === '/salir') { await env.DB.prepare('DELETE FROM chat_miembros WHERE chat = ?1 AND usuario = ?2').bind(chat, u.id).run(); if (C.tipo === 'grupo') await ponerMensaje(env, chat, u.id, yo.nombre, 'sis', { k: 'salio' }); return json({ ok: true }); }
  }
  return json({ error: 'no existe' }, 404);
}
