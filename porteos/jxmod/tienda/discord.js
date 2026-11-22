// ---------------- el bot de Discord de JXApps (JXMod y Stickerazo) ----------------
// Sin servidor aparte: Discord le manda cada comando a este Worker (interacciones por HTTP, firmadas con Ed25519:
// POST /api/discord/interacciones) y una tarea programada (cron, cada 10 minutos) avisa en el canal de anuncios las
// versiones nuevas de JXMod y de Stickerazo, y le cuenta a cada uno qué pasó con el bug o la idea que mandó.
// Comandos: /jxmod, /stickerazo, /estado (quién está jugando ahora), /bug y /sugerencia (un formulario que cae en «Bugs y
// sugerencias» del juego, el mismo panel), y para los admins /configurar (canal de anuncios, roles y AutoMod de Discord:
// insultos, contenido sexual, spam y menciones en masa), /roles (los botones para ponerse los roles) y /anunciar.
// Ser admin del bot no depende de los permisos de Discord: hay que mandarle el código con /admin (un formulario que no
// queda en el chat). Queda guardado por persona y por servidor; 5 intentos fallidos por hora como mucho; si el código
// cambia, los habilitados con el anterior dejan de serlo.
// Lo que necesita en Cloudflare: DISCORD_APP_ID y DISCORD_PUBLIC_KEY (variables, no son secretos), DISCORD_TOKEN y
// DISCORD_ADMIN_CODE (secretos: wrangler secret put …). Sin los tres primeros, /api/discord/ contesta 503 y el cron no
// hace nada; sin el código, los comandos de admin no andan.
import { tablas, postNuevo } from './panel.js';

const API = 'https://discord.com/api/v10';
const REPO = 'https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/';
const SITIO_SZ = 'https://stickerazo.pages.dev';
const ROSA = 0xff3e8a, AMARILLO = 0xffd23f, VIOLETA = 0x7a3cff, VERDE = 0x2ecc71, GRIS = 0x8d88a3;
const EFIMERO = 64, MIN = 60e3;
const ROLES = [['jxmod', 'JXMod', 0x9aa0a6], ['stickerazo', 'Stickerazo', AMARILLO], ['avisos', 'Avisos de versiones', ROSA]];
const enc = new TextEncoder();
const corto = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const deHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

// ---- la firma de Discord: Ed25519 sobre timestamp + cuerpo ----
let llave = null, llaveDe = '';
async function firmaBien(env, req, cuerpo) {
  const sig = req.headers.get('X-Signature-Ed25519'), ts = req.headers.get('X-Signature-Timestamp');
  if (!sig || !ts || !/^[0-9a-f]{128}$/i.test(sig) || !/^\d{1,13}$/.test(ts)) return false;
  if (!llave || llaveDe !== env.DISCORD_PUBLIC_KEY) {
    const raw = deHex(env.DISCORD_PUBLIC_KEY);
    try { llave = await crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']); }
    catch (e) { llave = await crypto.subtle.importKey('raw', raw, { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, false, ['verify']); }
    llaveDe = env.DISCORD_PUBLIC_KEY;
  }
  const alg = llave.algorithm && llave.algorithm.name === 'NODE-ED25519' ? 'NODE-ED25519' : 'Ed25519';
  return crypto.subtle.verify(alg, llave, deHex(sig), enc.encode(ts + cuerpo));
}

// ---- la API de Discord con el token del bot ----
async function dc(env, metodo, ruta, cuerpo, motivo) {
  const h = { Authorization: 'Bot ' + env.DISCORD_TOKEN, 'User-Agent': 'DiscordBot (' + SITIO_SZ + ', 1.0)' };
  if (cuerpo !== undefined) h['Content-Type'] = 'application/json';
  if (motivo) h['X-Audit-Log-Reason'] = encodeURIComponent(motivo);
  const r = await env.__fetch(API + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = { texto: t }; }
  if (!r.ok) throw Object.assign(new Error(`Discord ${metodo} ${ruta}: ${r.status} ${corto(t, 200)}`), { status: r.status, d });
  return d;
}

// ---- lo que guarda el bot: la configuración de cada servidor y los posts mandados desde Discord ----
let listas = false;
async function tablasDc(env) {
  if (listas) return; await tablas(env);
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_conf (guild TEXT PRIMARY KEY, canal TEXT, roles TEXT, automod TEXT, ult_jxmod INTEGER, ult_sz INTEGER, cambiado INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_posts (post TEXT PRIMARY KEY, usuario TEXT, canal TEXT, guild TEXT, tipo TEXT, titulo TEXT, estado TEXT, respuesta TEXT, creado INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_admins (guild TEXT, usuario TEXT, huella TEXT, desde INTEGER, PRIMARY KEY (guild, usuario))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_intentos (usuario TEXT, t INTEGER)'),
  ]);
  listas = true;
}
const conf = (env, g) => env.DB.prepare('SELECT * FROM dc_conf WHERE guild = ?1').bind(g).first();

// ---- las versiones (las mismas que leen el juego y la app) ----
async function versiones(env) {
  const [jx, sz] = await Promise.all([REPO + 'web/version.json', REPO + 'porteos/stickerazo/descargas/app.json'].map((u) =>
    env.__fetch(u + '?t=' + Date.now(), { cf: { cacheTtl: 60 } }).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  return { jx, sz };
}
function embedJxmod(v, titulo) {
  const notas = corto(String(v.notas_es || '').replace(/\r/g, ''), 1500);
  return { title: titulo || `JXMod ${v.version}`, description: notas || 'Versión nueva de JXMod.', color: VIOLETA,
    fields: [{ name: 'Celular (APK)', value: v.apk ? `[Bajar JXMod ${v.version}](${v.apk})` : '—', inline: true },
      { name: 'Navegador', value: v.web ? `[Jugar en la web](${v.web}) · pedí el código a los admins` : '—', inline: true }],
    footer: { text: 'JXApps · si ya lo tenés instalado, se actualiza solo' } };
}
function embedStickerazo(a, titulo) {
  return { title: titulo || `Stickerazo ${a.nombre}`, color: AMARILLO, url: SITIO_SZ,
    description: 'Tus stickers sin límites: recortá tus fotos en un toque, animalos y mandalos a WhatsApp. Gratis para Android.',
    thumbnail: { url: SITIO_SZ + '/a/icono_180.png' },
    fields: [{ name: 'Bajar', value: `[stickerazo.pages.dev](${SITIO_SZ})`, inline: true }, { name: 'Versión', value: String(a.nombre), inline: true }],
    footer: { text: 'JXApps' } };
}

// ---- las respuestas ----
const msg = (data) => new Response(JSON.stringify({ type: 4, data }), { headers: { 'Content-Type': 'application/json' } });
const efimero = (content, extra = {}) => msg({ content, flags: EFIMERO, allowed_mentions: { parse: [] }, ...extra });
const usuarioDe = (it) => (it.member && it.member.user) || it.user || {};
// ---- el código de admin: se guarda la huella (SHA-256) del código con que se habilitó, nunca el código ----
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function igualSeguro(a, b) { const [x, y] = await Promise.all([sha('jx|' + a), sha('jx|' + b)]); let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0; }
const huellaCodigo = async (env) => (await sha('jx-admin|' + env.DISCORD_ADMIN_CODE)).slice(0, 24);
async function esAdmin(env, it) {
  if (!env.DISCORD_ADMIN_CODE) return false;
  // (el que lo mandó en el servidor, o por mensaje privado al bot: ése vale en todos los servidores)
  const h = await huellaCodigo(env);
  const f = await env.DB.prepare("SELECT 1 AS s FROM dc_admins WHERE usuario = ?2 AND guild IN (?1, 'dm') AND huella = ?3").bind(it.guild_id || 'dm', usuarioDe(it).id, h).first();
  return !!f;
}
async function codigoAdmin(env, it, codigo) {
  const u = usuarioDe(it), ahora = Date.now();
  if (!env.DISCORD_ADMIN_CODE) return efimero('El código de admin todavía no está configurado en el servidor del bot.');
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM dc_intentos WHERE usuario = ?1 AND t > ?2').bind(u.id, ahora - 3600e3).first();
  if (n && n.n >= 5) return efimero('Demasiados intentos. Probá de nuevo en una hora.');
  if (!(await igualSeguro(String(codigo || '').trim(), env.DISCORD_ADMIN_CODE))) {
    await env.DB.prepare('INSERT INTO dc_intentos (usuario, t) VALUES (?1, ?2)').bind(u.id, ahora).run();
    return efimero(`Código incorrecto. Te quedan ${Math.max(0, 4 - (n ? n.n : 0))} intentos esta hora.`);
  }
  await env.DB.prepare('INSERT INTO dc_admins (guild, usuario, huella, desde) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(guild, usuario) DO UPDATE SET huella = ?3, desde = ?4').bind(it.guild_id || 'dm', u.id, await huellaCodigo(env), ahora).run();
  await env.DB.prepare('DELETE FROM dc_intentos WHERE usuario = ?1').bind(u.id).run();
  return efimero(it.guild_id ? 'Listo, ya sos admin del bot en este servidor: /configurar, /roles y /anunciar.' : 'Listo, ya sos admin del bot en todos los servidores donde está: /configurar, /roles y /anunciar.');
}

function modal(tipo) {
  const bug = tipo === 'bug';
  const campo = (id, label, estilo, req, max, ph) => ({ type: 1, components: [{ type: 4, custom_id: id, label, style: estilo, required: req, max_length: max, placeholder: ph }] });
  return new Response(JSON.stringify({ type: 9, data: { custom_id: tipo, title: bug ? 'Contanos el bug' : 'Tu idea para JXMod', components: [
    campo('titulo', bug ? '¿Qué pasa?' : '¿Qué se te ocurre?', 1, true, 90, bug ? 'Ej.: el mapa no tiene texturas' : 'Ej.: un modo de carreras'),
    campo('texto', bug ? 'Contalo con detalle (qué hiciste, qué esperabas)' : 'Contalo con detalle', 2, true, 1500, ''),
    ...(bug ? [campo('lugar', 'Mapa, mod o arma (si tiene que ver)', 1, false, 80, 'Ej.: gm_mallparking, Pee Swep'), campo('version', 'Versión de JXMod (si la sabés)', 1, false, 20, 'Ej.: 3.9.11')] : []),
  ] } }), { headers: { 'Content-Type': 'application/json' } });
}

async function comando(env, it, ctx) {
  const n = it.data.name, g = it.guild_id;
  if (n === 'jxmod') { const { jx } = await versiones(env); return jx ? msg({ embeds: [embedJxmod(jx)] }) : efimero('No pude leer la versión de JXMod ahora. Probá en un rato.'); }
  if (n === 'stickerazo') { const { sz } = await versiones(env); return sz ? msg({ embeds: [embedStickerazo(sz)] }) : efimero('No pude leer la versión de Stickerazo ahora.'); }
  if (n === 'estado') {
    const ahora = Date.now();
    const t = await env.DB.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT CASE WHEN sala != \'\' THEN sala END) AS salas FROM pn_presencia WHERE visto > ?1').bind(ahora - 2 * MIN).first();
    const m = await env.DB.prepare('SELECT mapa, COUNT(*) AS n FROM pn_presencia WHERE visto > ?1 AND mapa != \'\' GROUP BY mapa ORDER BY n DESC LIMIT 5').bind(ahora - 2 * MIN).all();
    const d = await env.DB.prepare('SELECT COUNT(*) AS n FROM pn_presencia WHERE visto > ?1').bind(ahora - 86400e3).first();
    const mapas = m.results.map((x) => `**${corto(x.mapa, 40)}** · ${x.n}`).join('\n') || 'Nadie en un mapa ahora';
    return msg({ embeds: [{ title: 'JXMod ahora', color: VERDE, fields: [{ name: 'Jugando', value: String(t ? t.n : 0), inline: true }, { name: 'Salas', value: String(t ? t.salas : 0), inline: true },
      { name: 'Hoy', value: String(d ? d.n : 0), inline: true }, { name: 'Mapas', value: mapas }], footer: { text: 'Se actualiza cada minuto' } }] });
  }
  if (n === 'bug' || n === 'sugerencia') return modal(n === 'bug' ? 'bug' : 'sug');
  if (n === 'admin') return new Response(JSON.stringify({ type: 9, data: { custom_id: 'admin', title: 'Código de admin', components: [{ type: 1, components: [{ type: 4, custom_id: 'codigo', label: 'El código', style: 1, required: true, max_length: 100 }] }] } }), { headers: { 'Content-Type': 'application/json' } });
  // ---- de acá para abajo, sólo quien mandó el código de admin ----
  if (!g) return efimero('Usalo adentro de un servidor.');
  if (!(await esAdmin(env, it))) return efimero('Ese comando es para admins: primero mandame el código con /admin.');
  if (n === 'configurar') { ctx.waitUntil(configurar(env, it)); return new Response(JSON.stringify({ type: 5, data: { flags: EFIMERO } }), { headers: { 'Content-Type': 'application/json' } }); }
  if (n === 'roles') {
    const c = await conf(env, g); const r = c && c.roles ? JSON.parse(c.roles) : null;
    if (!r) return efimero('Primero corré /configurar (crea los roles).');
    return msg({ embeds: [{ title: 'Elegí tus roles', color: ROSA, description: 'Tocá para ponerte o sacarte un rol.\n**Avisos de versiones**: te menciono cuando sale algo nuevo.' }],
      components: [{ type: 1, components: ROLES.map(([k, nom]) => ({ type: 2, style: k === 'avisos' ? 1 : 2, label: nom, custom_id: 'rol:' + k })) }] });
  }
  if (n === 'anunciar') {
    const op = Object.fromEntries((it.data.options || []).map((o) => [o.name, o.value]));
    const c = await conf(env, g); const r = c && c.roles ? JSON.parse(c.roles) : {};
    const avisar = op.avisar && r.avisos ? `<@&${r.avisos}>` : '';
    return msg({ content: avisar || undefined, allowed_mentions: { roles: avisar ? [r.avisos] : [] }, embeds: [{ title: corto(op.titulo || 'Anuncio', 250), description: corto(op.texto, 3800), color: ROSA, footer: { text: 'JXApps' } }] });
  }
  return efimero('No conozco ese comando.');
}

// /configurar: este canal pasa a ser el de anuncios; crea los roles que falten y las reglas de AutoMod de Discord
async function configurar(env, it) {
  const g = it.guild_id, hecho = [];
  try {
    const c = await conf(env, g) || {}; const roles = c.roles ? JSON.parse(c.roles) : {}; const am = c.automod ? JSON.parse(c.automod) : {};
    const hay = await dc(env, 'GET', `/guilds/${g}/roles`); const porId = new Map(hay.map((r) => [r.id, r]));
    for (const [k, nombre, color] of ROLES) {
      if (roles[k] && porId.has(roles[k])) continue;
      const ya = hay.find((r) => r.name === nombre);
      roles[k] = ya ? ya.id : (await dc(env, 'POST', `/guilds/${g}/roles`, { name: nombre, color, mentionable: k === 'avisos', hoist: false }, 'JX Bot: /configurar')).id;
      hecho.push(`rol **${nombre}**`);
    }
    const reglas = await dc(env, 'GET', `/guilds/${g}/auto-moderation/rules`); const ids = new Set(reglas.map((r) => r.id));
    const accion = [{ type: 1, metadata: { custom_message: 'JX Bot: ese mensaje no va en este servidor.' } }];
    const QUIERO = [
      ['malas', { name: 'JX: insultos y contenido sexual', event_type: 1, trigger_type: 4, trigger_metadata: { presets: [1, 2, 3] }, actions: accion, enabled: true }],
      ['spam', { name: 'JX: spam', event_type: 1, trigger_type: 3, actions: [{ type: 1 }], enabled: true }],
      ['menciones', { name: 'JX: menciones en masa', event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 6, mention_raid_protection_enabled: true }, actions: accion, enabled: true }],
    ];
    for (const [k, regla] of QUIERO) {
      if (am[k] && ids.has(am[k])) continue;
      const ya = reglas.find((r) => r.name === regla.name || (regla.trigger_type !== 1 && r.trigger_type === regla.trigger_type));   // (de spam, de palabras predefinidas y de menciones Discord deja una sola por servidor: si ya hay, se usa ésa)
      try { am[k] = ya ? ya.id : (await dc(env, 'POST', `/guilds/${g}/auto-moderation/rules`, regla, 'JX Bot: /configurar')).id; if (!ya) hecho.push(`AutoMod **${regla.name.slice(4)}**`); }
      catch (e) { hecho.push(`AutoMod ${regla.name.slice(4)}: no pude (${e.status || 'error'})`); }
    }
    const { jx, sz } = await versiones(env);
    await env.DB.prepare('INSERT INTO dc_conf (guild, canal, roles, automod, ult_jxmod, ult_sz, cambiado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(guild) DO UPDATE SET canal = ?2, roles = ?3, automod = ?4, ult_jxmod = COALESCE(ult_jxmod, ?5), ult_sz = COALESCE(ult_sz, ?6), cambiado = ?7')
      .bind(g, it.channel_id, JSON.stringify(roles), JSON.stringify(am), jx ? jx.codigo : 0, sz ? sz.v : 0, Date.now()).run();
    hecho.unshift(`canal de anuncios: <#${it.channel_id}>`);
    await dc(env, 'PATCH', `/webhooks/${env.DISCORD_APP_ID}/${it.token}/messages/@original`, { content: '**Listo.**\n• ' + hecho.join('\n• ') + '\n\nAhora podés poner /roles en el canal que quieras.' });
  } catch (e) {
    await dc(env, 'PATCH', `/webhooks/${env.DISCORD_APP_ID}/${it.token}/messages/@original`, { content: 'No pude terminar: ' + corto(e.message, 300) + '\n(¿El bot tiene permiso para gestionar roles y el servidor?)' }).catch(() => {});
  }
}

async function boton(env, it) {
  const id = it.data.custom_id || '';
  if (!id.startsWith('rol:')) return efimero('Ese botón ya no anda.');
  const k = id.slice(4), c = await conf(env, it.guild_id), r = c && c.roles ? JSON.parse(c.roles) : {}, rol = r[k];
  if (!rol) return efimero('Ese rol no está configurado. Avisale a un admin.');
  const u = usuarioDe(it), tiene = (it.member.roles || []).includes(rol), nombre = (ROLES.find((x) => x[0] === k) || [])[1];
  try { await dc(env, tiene ? 'DELETE' : 'PUT', `/guilds/${it.guild_id}/members/${u.id}/roles/${rol}`, undefined, 'JX Bot: botón de roles'); }
  catch (e) { return efimero('No pude cambiarte el rol (el rol del bot tiene que estar más arriba que ese rol).'); }
  return efimero(tiene ? `Listo, te saqué **${nombre}**.` : `Listo, ya tenés **${nombre}**.`);
}

async function formulario(env, it) {
  const tipo = it.data.custom_id === 'bug' ? 'bug' : 'sug', u = usuarioDe(it);
  const v = {}; for (const fila of it.data.components || []) for (const c of fila.components || []) v[c.custom_id] = c.value;
  if (it.data.custom_id === 'admin') return codigoAdmin(env, it, v.codigo);
  const autor = 'dc:' + u.id, ahora = Date.now();
  // (lo mismo que en el juego: una cada 3 minutos y 10 por día)
  const h = await env.DB.prepare('SELECT MAX(creado) AS t, COUNT(*) AS dia FROM pn_posts WHERE autor = ?1 AND creado > ?2').bind(autor, ahora - 86400e3).first();
  if (h && h.t && ahora - h.t < 3 * MIN) return efimero(`Esperá ${Math.ceil((3 * MIN - (ahora - h.t)) / MIN)} min para mandar otro (así no se satura).`);
  if (h && h.dia >= 10) return efimero('Llegaste al máximo de hoy: seguí mañana.');
  const res = await postNuevo(env, { tipo, titulo: v.titulo, texto: v.texto, lugar: v.lugar, version: v.version }, autor, u.global_name || u.username || 'Discord', 'discord', false);
  if (res.error) return efimero('No pude guardarlo: ' + res.error);
  await env.DB.prepare('INSERT INTO dc_posts (post, usuario, canal, guild, tipo, titulo, estado, respuesta, creado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(res.id, u.id, it.channel_id || '', it.guild_id || '', tipo, String(v.titulo || '').slice(0, 90), 'nuevo', '', ahora).run();
  return msg({ embeds: [{ title: (tipo === 'bug' ? 'Bug: ' : 'Idea: ') + corto(v.titulo, 200), description: corto(v.texto, 1500), color: tipo === 'bug' ? 0xff5a5f : AMARILLO,
    fields: [...(v.lugar ? [{ name: 'Dónde', value: corto(v.lugar, 80), inline: true }] : []), ...(v.version ? [{ name: 'Versión', value: corto(v.version, 20), inline: true }] : []), { name: 'Estado', value: 'Nuevo', inline: true }],
    footer: { text: `Mandado por ${u.global_name || u.username} · también está en «Bugs y sugerencias» del juego · te aviso cuando lo vean` } }], allowed_mentions: { parse: [] } });
}

export async function discordRutas(req, env, url, r, ctx) {
  if (!r.startsWith('/api/discord/')) return null;
  env.__fetch = env.__fetch || fetch;
  if (!env.DISCORD_PUBLIC_KEY || !env.DISCORD_APP_ID) return new Response('el bot no está configurado', { status: 503 });
  if (r !== '/api/discord/interacciones' || req.method !== 'POST') return new Response('no existe', { status: 404 });
  const cuerpo = await req.text();
  if (!(await firmaBien(env, req, cuerpo).catch(() => false))) return new Response('firma inválida', { status: 401 });
  const it = JSON.parse(cuerpo);
  if (it.type === 1) return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
  await tablasDc(env);
  try {
    if (it.type === 2) return await comando(env, it, ctx);
    if (it.type === 3) return await boton(env, it);
    if (it.type === 5) return await formulario(env, it);
  } catch (e) { console.error('discord', e); return efimero('Algo salió mal: ' + corto(e.message, 200)); }
  return new Response('tipo desconocido', { status: 400 });
}

// ---- el cron: versiones nuevas y qué pasó con los bugs mandados desde Discord ----
const ESTADO_TXT = { nuevo: 'Nuevo', visto: 'Visto', en_curso: 'En curso', hecho: 'Hecho', no: 'No va' };
export async function discordCron(env) {
  if (!env.DISCORD_TOKEN || !env.DISCORD_APP_ID) return;
  env.__fetch = env.__fetch || fetch; await tablasDc(env);
  const servidores = (await env.DB.prepare('SELECT * FROM dc_conf WHERE canal IS NOT NULL').all()).results;
  if (servidores.length) {
    const { jx, sz } = await versiones(env);
    for (const s of servidores) {
      const roles = s.roles ? JSON.parse(s.roles) : {}, avisar = roles.avisos ? `<@&${roles.avisos}>` : undefined, men = { roles: roles.avisos ? [roles.avisos] : [] };
      try {
        if (jx && jx.codigo > (s.ult_jxmod || 0)) {
          await dc(env, 'POST', `/channels/${s.canal}/messages`, { content: avisar, allowed_mentions: men, embeds: [embedJxmod(jx, `Salió JXMod ${jx.version}`)] });
          await env.DB.prepare('UPDATE dc_conf SET ult_jxmod = ?1 WHERE guild = ?2').bind(jx.codigo, s.guild).run();
        }
        if (sz && sz.v > (s.ult_sz || 0)) {
          await dc(env, 'POST', `/channels/${s.canal}/messages`, { content: avisar, allowed_mentions: men, embeds: [embedStickerazo(sz, `Salió Stickerazo ${sz.nombre}`)] });
          await env.DB.prepare('UPDATE dc_conf SET ult_sz = ?1 WHERE guild = ?2').bind(sz.v, s.guild).run();
        }
      } catch (e) { console.error('discord cron', s.guild, e.message); }
    }
  }
  // (los bugs e ideas de Discord a los que el panel les cambió el estado o les contestó: se le avisa a quien lo mandó)
  const cambios = (await env.DB.prepare('SELECT d.*, p.estado AS pe, p.respuesta AS pr FROM dc_posts d JOIN pn_posts p ON p.id = d.post WHERE (p.estado != d.estado OR COALESCE(p.respuesta, \'\') != d.respuesta) AND d.creado > ?1 LIMIT 20').bind(Date.now() - 60 * 86400e3).all()).results;
  for (const x of cambios) {
    try {
      if (x.canal) await dc(env, 'POST', `/channels/${x.canal}/messages`, { content: `<@${x.usuario}>`, allowed_mentions: { users: [x.usuario] },
        embeds: [{ title: `${x.tipo === 'bug' ? 'Tu bug' : 'Tu idea'}: ${corto(x.titulo, 200)}`, color: x.pe === 'hecho' ? VERDE : x.pe === 'no' ? GRIS : VIOLETA,
          fields: [{ name: 'Estado', value: ESTADO_TXT[x.pe] || x.pe, inline: true }, ...(x.pr ? [{ name: 'Respuesta', value: corto(x.pr, 1000) }] : [])], footer: { text: 'JXApps · Bugs y sugerencias' } }] });
      await env.DB.prepare('UPDATE dc_posts SET estado = ?1, respuesta = ?2 WHERE post = ?3').bind(x.pe, x.pr || '', x.post).run();
    } catch (e) { console.error('discord aviso', x.post, e.message); if (e.status === 403 || e.status === 404) await env.DB.prepare('UPDATE dc_posts SET estado = ?1, respuesta = ?2 WHERE post = ?3').bind(x.pe, x.pr || '', x.post).run(); }
  }
}

// ---- los comandos que se registran en Discord (herramientas/discord_bot.py los sube) ----
export const COMANDOS = [
  { name: 'jxmod', description: 'La última versión de JXMod, qué trae y dónde bajarla' },
  { name: 'stickerazo', description: 'Stickerazo: la app para hacer stickers, y dónde bajarla' },
  { name: 'estado', description: 'Cuántos están jugando JXMod ahora y en qué mapas' },
  { name: 'bug', description: 'Mandá un bug de JXMod (llega al panel de «Bugs y sugerencias»)' },
  { name: 'sugerencia', description: 'Mandá una idea para JXMod' },
  { name: 'admin', description: 'Mandale al bot el código de admin (no queda en el chat)', dm_permission: true, contexts: [0, 1] },
  { name: 'configurar', description: 'Admins (con código): este canal para anuncios, roles y AutoMod', dm_permission: false },
  { name: 'roles', description: 'Admins (con código): pone los botones para elegir roles', dm_permission: false },
  { name: 'anunciar', description: 'Admins (con código): un anuncio con el estilo de JXApps', dm_permission: false, options: [
    { type: 3, name: 'titulo', description: 'El título', required: true, max_length: 250 },
    { type: 3, name: 'texto', description: 'El texto', required: true, max_length: 3800 },
    { type: 5, name: 'avisar', description: 'Mencionar al rol «Avisos de versiones»' }] },
];
