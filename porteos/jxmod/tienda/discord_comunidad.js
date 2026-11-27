// ---------------- JXBot para la comunidad: bienvenida, rol automático, niveles, moderación y utilidades ----------------
// Lo que pasa en el servidor (alguien entra o se va, los mensajes para la XP) llega por la puerta (discord_puerta.js, el
// gateway de Discord, con el permiso «Server Members»); los comandos, por HTTP como los demás (discord.js).
//   · Bienvenida (/bienvenida): una tarjeta con el banner de JXApps, la foto de quien llegó, el número de persona, los
//     canales para empezar (reglas, descargas) y botones (elegir roles, bajar JXMod, Stickerazo). Mensaje propio con
//     {usuario} {nombre} {servidor} {numero}. Opcional: despedida y un mensaje privado. Cada 50 personas, festejo.
//   · Rol automático (/autorol): hasta 5 roles para cada persona que entra (a los bots no).
//   · Niveles (/nivel, /top, /niveles): XP por charlar (15 a 25 por mensaje, una vez por minuto, como MEE6), aviso al
//     subir y roles de premio por nivel (/niveles crear arma unos de fábrica).
//   · Registro (/registro: entradas, salidas, lo que hacen los mods y las alertas). La moderación está en
//     discord_moderacion.js.
//   · Utilidades: /servidor, /usuario, /encuesta (las encuestas de Discord) y /ayuda.
// Los de configurar y moderar piden el código de admin (como los demás de admin) y además Discord sólo se los muestra a
// quien tiene el permiso que corresponde (default_member_permissions), así no le llenan la lista a todos.
import { dc, corto, msg, efimero, diferido, completar, usuarioDe, opciones, traer, REPO, SITIO_SZ, ROSA, AMARILLO, VIOLETA, VERDE, GRIS, ROJO, MIN } from './discord_base.js';

export const BANNER = REPO + 'porteos/jxmod/diseno/discord/bienvenida.jpg';
const DIA = 86400e3;
export const PERM = { GESTIONAR_SERVIDOR: String(1 << 5), GESTIONAR_MENSAJES: String(1 << 13), MODERAR: String(1n << 40n), BANEAR: String(1 << 2), EXPULSAR: String(1 << 1), GESTIONAR_CANALES: String(1 << 4) };

// ---- tablas y ajustes de cada servidor ----
let listas = false;
export async function tablasCom(env) {
  if (listas) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_ajustes (guild TEXT, clave TEXT, valor TEXT, PRIMARY KEY (guild, clave))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_xp (guild TEXT, usuario TEXT, xp INTEGER, nivel INTEGER, msgs INTEGER, t INTEGER, PRIMARY KEY (guild, usuario))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_dc_xp ON dc_xp(guild, xp)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_nivel_roles (guild TEXT, nivel INTEGER, rol TEXT, PRIMARY KEY (guild, nivel))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_avisos (id INTEGER PRIMARY KEY AUTOINCREMENT, guild TEXT, usuario TEXT, motivo TEXT, autor TEXT, t INTEGER)'),
  ]);
  listas = true;
}
// (en memoria un minuto; cuando un comando los cambia, el Worker le avisa a la puerta para que los vuelva a leer)
const cacheAj = new Map();
export const olvidarAjustes = (g) => cacheAj.delete(g);
export async function ajustes(env, g) {
  const c = cacheAj.get(g); if (c && Date.now() - c.t < 60e3) return c.v;
  await tablasCom(env); const v = {};
  for (const r of (await env.DB.prepare('SELECT clave, valor FROM dc_ajustes WHERE guild = ?1').bind(g).all()).results) { try { v[r.clave] = JSON.parse(r.valor); } catch (e) { /* roto: se ignora */ } }
  cacheAj.set(g, { t: Date.now(), v }); return v;
}
export async function ajustar(env, g, clave, valor) {
  await tablasCom(env);
  if (valor == null) await env.DB.prepare('DELETE FROM dc_ajustes WHERE guild = ?1 AND clave = ?2').bind(g, clave).run();
  else await env.DB.prepare('INSERT INTO dc_ajustes (guild, clave, valor) VALUES (?1, ?2, ?3) ON CONFLICT(guild, clave) DO UPDATE SET valor = ?3').bind(g, clave, JSON.stringify(valor)).run();
  cacheAj.delete(g);
}

// ---- ayudas ----
export const avatarDe = (u, tam = 256) => (u && u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=${tam}` : `https://cdn.discordapp.com/embed/avatars/${u && u.id ? Number((BigInt(u.id) >> 22n) % 6n) : 0}.png`);
export const nombreDe = (u, m) => (m && m.nick) || (u && (u.global_name || u.username)) || 'alguien';
export const creadoEl = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);
const ts = (ms, f = 'R') => `<t:${Math.floor(ms / 1000)}:${f}>`;
const num = (n) => Number(n || 0).toLocaleString('es-AR');
// lo que la bienvenida necesita del servidor (del GUILD_CREATE en la puerta, o de la API en un comando)
export function infoDe(g) {
  const permisos = g.roles ? Object.fromEntries(g.roles.map((r) => [r.id, r.permissions])) : undefined;
  const ch = g.channels || [], descargas = ch.find((c) => c.type === 0 && /descarga|download/i.test(c.name)) || ch.find((c) => (c.type === 0 || c.type === 5) && /actualiza|update/i.test(c.name));
  return { nombre: g.name, miembros: g.member_count || g.approximate_member_count || 0, reglas: g.rules_channel_id || (ch.find((c) => c.type === 0 && /regla|rules/i.test(c.name)) || {}).id || null, descargas: descargas ? descargas.id : null, icono: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256` : null, permisos, dueno: g.owner_id };
}
// ¿es mod? el dueño, quien tenga un rol con permisos de moderación (admin, gestionar servidor o mensajes, expulsar,
// banear, aislar) o el rol de mods de /registro. (@everyone no cuenta: si tuviera esos permisos, todos serían mods)
export const BITS_MOD = 8n | 32n | 2n | 4n | 8192n | (1n << 40n);
export function esModerador(info, rolMods, uid, roles, g, rangos) {
  if (rangos && (rangos[uid] === 'mod' || rangos[uid] === 'admin')) return true;   // (los rangos de /rango)
  if (!info) return false;
  if (info.dueno && info.dueno === uid) return true;
  if (rolMods && roles.includes(rolMods)) return true;
  let p = 0n; for (const r of roles) if (r !== g && info.permisos && info.permisos[r]) p |= BigInt(info.permisos[r]);
  return (p & BITS_MOD) !== 0n;
}
export async function esModInteraccion(env, it) {   // (en un comando, Discord ya manda los permisos calculados)
  const m = it.member; if (!m || !it.guild_id) return false;
  if ((BigInt(m.permissions || '0') & BITS_MOD) !== 0n) return true;
  const aj = await ajustes(env, it.guild_id); const uid = m.user && m.user.id;
  if (aj.rangos && uid && (aj.rangos[uid] === 'mod' || aj.rangos[uid] === 'admin')) return true;   // (los rangos de /rango)
  return !!(aj.mods && (m.roles || []).includes(aj.mods));
}
export async function infoServidor(env, g) {
  const [s, ch] = await Promise.all([dc(env, 'GET', `/guilds/${g}?with_counts=true`), dc(env, 'GET', `/guilds/${g}/channels`).catch(() => [])]);
  return { ...infoDe({ ...s, channels: ch }), crudo: s, canales: ch.length };
}
let verJX = null, verT = 0;
async function apkJX(env) {
  if (verJX && Date.now() - verT < 10 * 60e3) return verJX;
  try { const r = await traer(env, REPO + 'web/version.json?t=' + Date.now()); if (r.ok) { verJX = await r.json(); verT = Date.now(); } } catch (e) { /* sin internet: sin botón */ }
  return verJX;
}
async function rolesListos(env, g) {   // (los botones de roles de /configurar)
  try { const c = await env.DB.prepare('SELECT roles FROM dc_conf WHERE guild = ?1').bind(g).first(); return !!(c && c.roles && Object.keys(JSON.parse(c.roles)).length); } catch (e) { return false; }
}
// el registro de moderación (si hay canal); nunca rompe lo que lo llamó
export async function registrar(env, g, embed) {
  try { const aj = await ajustes(env, g); if (aj.registro) await dc(env, 'POST', `/channels/${aj.registro}/messages`, { embeds: [{ timestamp: new Date().toISOString(), ...embed }], allowed_mentions: { parse: [] } }); }
  catch (e) { console.error('registro', g, e.message); }
}
// ¿el bot puede dar este rol? (su rol más alto tiene que estar más arriba; con la misma posición, manda el más viejo)
export async function puedeDar(env, g, rolId) {
  const [roles, yo] = await Promise.all([dc(env, 'GET', `/guilds/${g}/roles`), dc(env, 'GET', `/guilds/${g}/members/${env.DISCORD_APP_ID}`)]);
  const orden = (r) => [r.position, -BigInt(r.id)], mayor = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1];
  const rol = roles.find((r) => r.id === rolId); if (!rol) return { ok: false, por: 'no existe' };
  if (rol.managed || rol.id === g) return { ok: false, por: 'es de una integración o @everyone', rol };
  const mios = roles.filter((r) => (yo.roles || []).includes(r.id)); if (!mios.length) return { ok: false, por: 'el bot no tiene rol', rol };
  const top = mios.reduce((a, r) => (mayor(orden(r), orden(a)) ? r : a));
  return mayor(orden(top), orden(rol)) ? { ok: true, rol } : { ok: false, por: 'jerarquía', rol, top };
}
const avisoJerarquia = (p) => p.por === 'jerarquía' ? `El rol del bot (**${p.top.name}**) tiene que estar más arriba que **${p.rol.name}**: en Ajustes del servidor → Roles, arrastrá **JXBot** por encima.` : `No puedo dar ese rol: ${p.por}.`;

// ---- bienvenida y despedida ----
const FRASES = ['Ojo: Pepe siempre vuelve.', 'Dato: la Physics Gun de JXMod es azul y tiene tres garras.', 'Nadie sabe qué hay del otro lado de La grieta.', 'Si encontrás un bug, mandalo con /bug.',
  'Preguntame lo que quieras: respondé a un mensaje mío o usá /jb.', 'Charlando ganás XP: mirá tu nivel con /nivel.', 'En JXMod se instalan mods del Workshop de Garry\'s Mod.', 'Probá los Pill Packs: te transformás en personajes con habilidades.'];
export const rellenar = (plantilla, d) => String(plantilla).replace(/\{(usuario|nombre|servidor|numero)\}/g, (_, k) => (d[k] == null ? '' : d[k]));
export async function tarjetaBienvenida(env, g, info, u, miembro, { prueba = false } = {}) {
  const b = (await ajustes(env, g)).bienvenida || {}, roles = await rolesListos(env, g), v = await apkJX(env);
  const d = { usuario: `<@${u.id}>`, nombre: nombreDe(u, miembro), servidor: info.nombre || 'el servidor', numero: info.miembros ? num(info.miembros) : '' };
  const pasos = [...(info.descargas ? [`Bajá el juego en <#${info.descargas}>`] : []), ...(info.reglas ? [`Leé las <#${info.reglas}>`] : []),
    'Hablame cuando quieras: respondé a un mensaje mío, mencioname o usá **/jb**', ...(roles ? ['Elegí tus roles con el botón de abajo'] : [])];
  const texto = b.mensaje ? rellenar(b.mensaje, d) : `¡Hola ${d.usuario}! Te damos la bienvenida a **${d.servidor}**${d.numero ? `: sos la persona número **${d.numero}** en llegar` : ''}.\n\n${pasos.map((p) => '› ' + p).join('\n')}`;
  const botones = [...(roles ? [{ type: 2, style: 1, label: 'Elegir roles', custom_id: 'roles:ver' }] : []), ...(v && v.apk ? [{ type: 2, style: 5, label: `Bajar JXMod ${v.version || ''}`.trim(), url: v.apk }] : []), { type: 2, style: 5, label: 'Stickerazo', url: SITIO_SZ }];
  return { content: (prueba ? '(prueba) ' : '') + `<@${u.id}>`, allowed_mentions: { users: prueba ? [] : [u.id] },
    embeds: [{ color: ROSA, title: `Llegó ${corto(d.nombre, 80)}`, description: corto(texto, 3800), thumbnail: { url: avatarDe(u) }, image: { url: BANNER }, footer: { text: FRASES[Math.floor(Math.random() * FRASES.length)] }, timestamp: new Date().toISOString() }],
    components: [{ type: 1, components: botones }] };
}
export async function alEntrar(env, g, info, m) {
  const u = m && m.user; if (!u) return { nada: true };
  const aj = await ajustes(env, g), r = { roles: [], errores: [] };
  if (!u.bot) for (const rol of aj.autorol || []) {
    try { await dc(env, 'PUT', `/guilds/${g}/members/${u.id}/roles/${rol}`, undefined, 'JXBot: rol automático'); r.roles.push(rol); }
    catch (e) { r.errores.push(rol); await registrar(env, g, { color: ROJO, description: `No pude darle <@&${rol}> a <@${u.id}> (rol automático): ${e.status === 403 ? 'el rol de JXBot tiene que estar más arriba' : corto(e.message, 120)}.` }); }
  }
  const b = aj.bienvenida;
  if (b && b.canal && !u.bot) {
    await dc(env, 'POST', `/channels/${b.canal}/messages`, await tarjetaBienvenida(env, g, info, u, m)).then(() => { r.bienvenida = true; }).catch((e) => { r.errores.push('bienvenida'); console.error('bienvenida', e.message); });
    if (info.miembros && info.miembros % 50 === 0) {   // (cada 50: como el evento de los 300)
      await dc(env, 'POST', `/channels/${b.canal}/messages`, { embeds: [{ color: AMARILLO, title: `¡Somos ${num(info.miembros)}!`, description: `Con <@${u.id}> llegamos a **${num(info.miembros)}** en ${info.nombre || 'el servidor'}. Gracias por estar.`, footer: { text: 'JXApps' } }], allowed_mentions: { parse: [] } }).then(() => { r.hito = true; }).catch(() => {});
    }
  }
  if (b && b.privado && !u.bot) {
    try {
      const ch = await dc(env, 'POST', '/users/@me/channels', { recipient_id: u.id });
      await dc(env, 'POST', `/channels/${ch.id}/messages`, { embeds: [{ color: VIOLETA, title: `Bienvenida a ${corto(info.nombre || 'JXApps', 80)}`, description: `¡Hola! Soy JXBot. Lo que querés saber de JXMod o Stickerazo, preguntámelo por acá mismo.\n\n› /jxmod: la última versión y dónde bajarla\n› /bug y /sugerencia: mandá lo que encuentres\n› /nivel: charlando en el servidor ganás XP`, footer: { text: 'JXApps' } }] });
      r.privado = true;
    } catch (e) { /* tiene los privados cerrados */ }
  }
  const edad = Date.now() - creadoEl(u.id);
  await registrar(env, g, { color: VERDE, author: { name: `${nombreDe(u, m)} entró`, icon_url: avatarDe(u, 64) }, description: `<@${u.id}> · cuenta creada ${ts(creadoEl(u.id))}${edad < 7 * DIA ? ' · **cuenta nueva**' : ''}${u.bot ? ' · es un bot' : ''}`, footer: { text: `Miembros: ${num(info.miembros)}` } });
  return r;
}
export async function alSalir(env, g, info, u) {
  if (!u) return {};
  const aj = await ajustes(env, g), b = aj.bienvenida, r = {};
  if (b && b.canal && b.despedida && !u.bot) await dc(env, 'POST', `/channels/${b.canal}/messages`, { embeds: [{ color: GRIS, description: `**${corto(nombreDe(u), 80)}** se fue del servidor.${info.miembros ? ` Ahora somos ${num(info.miembros)}.` : ''}` }], allowed_mentions: { parse: [] } }).then(() => { r.despedida = true; }).catch(() => {});
  await registrar(env, g, { color: GRIS, author: { name: `${nombreDe(u)} se fue`, icon_url: avatarDe(u, 64) }, description: `<@${u.id}> (${corto(u.username || '', 40)})`, footer: { text: `Miembros: ${num(info.miembros)}` } });
  return r;
}

// ---- niveles (la cuenta de MEE6: pasar del nivel n al n+1 pide 5n² + 50n + 100 de XP) ----
export const necesita = (n) => 5 * n * n + 50 * n + 100;
export function nivelDe(xp) { let n = 0; xp = Math.max(0, xp | 0); while (xp >= necesita(n)) { xp -= necesita(n); n++; } return { nivel: n, resto: xp, falta: necesita(n) }; }
const ultXP = new Map();   // (guild:usuario → cuándo ganó por última vez; así la base no se consulta en cada mensaje)
export async function darXP(env, m, ahora = Date.now()) {
  if (!m || !m.guild_id || !m.author || m.author.bot || m.webhook_id || (m.type !== 0 && m.type !== 19)) return null;
  const k = m.guild_id + ':' + m.author.id; if (ahora - (ultXP.get(k) || 0) < 60e3) return null;
  if (ultXP.size > 20000) ultXP.clear(); ultXP.set(k, ahora);
  await tablasCom(env);
  const f = await env.DB.prepare('SELECT xp, nivel, t FROM dc_xp WHERE guild = ?1 AND usuario = ?2').bind(m.guild_id, m.author.id).first();
  if (f && ahora - f.t < 60e3) return null;
  const gana = 15 + Math.floor(Math.random() * 11), xp = (f ? f.xp : 0) + gana, { nivel } = nivelDe(xp), antes = f ? f.nivel : 0;
  await env.DB.prepare('INSERT INTO dc_xp (guild, usuario, xp, nivel, msgs, t) VALUES (?1, ?2, ?3, ?4, 1, ?5) ON CONFLICT(guild, usuario) DO UPDATE SET xp = ?3, nivel = ?4, msgs = msgs + 1, t = ?5').bind(m.guild_id, m.author.id, xp, nivel, ahora).run();
  if (nivel <= antes) return { gana, xp, nivel };
  // subió de nivel: los roles de premio que le falten y el aviso
  const premios = (await env.DB.prepare('SELECT nivel, rol FROM dc_nivel_roles WHERE guild = ?1 AND nivel <= ?2 ORDER BY nivel').bind(m.guild_id, nivel).all()).results;
  const tiene = new Set((m.member && m.member.roles) || []), nuevos = [];
  for (const p of premios) {
    if (tiene.has(p.rol)) continue;
    try { await dc(env, 'PUT', `/guilds/${m.guild_id}/members/${m.author.id}/roles/${p.rol}`, undefined, `JXBot: premio del nivel ${p.nivel}`); nuevos.push(p.rol); }
    catch (e) { await registrar(env, m.guild_id, { color: ROJO, description: `No pude darle <@&${p.rol}> (premio del nivel ${p.nivel}) a <@${m.author.id}>: ${e.status === 403 ? 'el rol de JXBot tiene que estar más arriba' : corto(e.message, 120)}.` }); }
  }
  const nv = (await ajustes(env, m.guild_id)).niveles || {};
  if (nv.avisos !== false) {
    await dc(env, 'POST', `/channels/${nv.canal || m.channel_id}/messages`, { content: `<@${m.author.id}>`, allowed_mentions: { users: [m.author.id] },
      embeds: [{ color: VIOLETA, description: `**¡Subiste a nivel ${nivel}!**${nuevos.length ? `\nGanaste ${nuevos.map((r) => `<@&${r}>`).join(', ')}.` : ''}`, footer: { text: 'Mirá tu progreso con /nivel · el ranking con /top' } }] }).catch(() => {});
  }
  return { gana, xp, nivel, subio: true, nuevos };
}
const barra = (a, b, n = 16) => { const k = Math.max(0, Math.min(n, Math.round((a / b) * n))); return '█'.repeat(k) + '░'.repeat(n - k); };
const NIVELES_FABRICA = [[5, 'Activo', 0x57c7ff], [10, 'Habitué', 0x2ecc71], [20, 'Veterano', AMARILLO], [35, 'Leyenda', 0xff8a1f], [50, 'Mítico', ROSA]];

// ---- los comandos ----
const ADMIN = new Set(['bienvenida', 'autorol', 'niveles', 'registro', 'encuesta']);
const DE_COMUNIDAD = new Set([...ADMIN, 'ayuda', 'nivel', 'top', 'servidor', 'usuario']);
const elUsuario = (it, id) => { const R = (it.data && it.data.resolved) || {}; return { u: (R.users || {})[id] || (id === usuarioDe(it).id ? usuarioDe(it) : { id }), m: (R.members || {})[id] || (id === usuarioDe(it).id ? it.member : null) }; };

export async function comandoComunidad(env, it, ctx, { esAdmin, avisarPuerta = () => {} }) {
  const n = it.data.name; if (!DE_COMUNIDAD.has(n)) return null;
  const g = it.guild_id, yo = usuarioDe(it), { sub, op } = opciones(it);
  if (n === 'ayuda') return efimero('', { embeds: [ayuda()] });
  if (!g) return efimero('Usalo adentro de un servidor.');
  await tablasCom(env);
  if (n === 'nivel') {
    const { u, m } = elUsuario(it, op.usuario || yo.id);
    const f = await env.DB.prepare('SELECT xp, nivel, msgs FROM dc_xp WHERE guild = ?1 AND usuario = ?2').bind(g, u.id).first();
    if (!f) return efimero(u.id === yo.id ? 'Todavía no tenés XP: se gana charlando en el servidor (un poco por minuto).' : 'Todavía no tiene XP.');
    const p = await env.DB.prepare('SELECT COUNT(*) AS n FROM dc_xp WHERE guild = ?1 AND xp > ?2').bind(g, f.xp).first(), x = nivelDe(f.xp);
    return msg({ embeds: [{ color: VIOLETA, author: { name: nombreDe(u, m), icon_url: avatarDe(u, 64) }, title: `Nivel ${x.nivel}`, description: `\`${barra(x.resto, x.falta)}\` ${num(x.resto)} / ${num(x.falta)} XP\n\nPuesto **#${(p ? p.n : 0) + 1}** · ${num(f.xp)} XP en total · ${num(f.msgs)} mensajes`, footer: { text: 'Se gana XP charlando: 15 a 25 por mensaje, una vez por minuto' } }], allowed_mentions: { parse: [] } });
  }
  if (n === 'top') {
    const L = (await env.DB.prepare('SELECT usuario, xp, nivel FROM dc_xp WHERE guild = ?1 ORDER BY xp DESC LIMIT 10').bind(g).all()).results;
    if (!L.length) return efimero('Todavía nadie tiene XP: se gana charlando.');
    return msg({ embeds: [{ color: AMARILLO, title: 'Los que más charlan', description: L.map((x, i) => `**${i + 1}.** <@${x.usuario}> · nivel ${x.nivel} · ${num(x.xp)} XP`).join('\n'), footer: { text: 'Tu nivel: /nivel' } }], allowed_mentions: { parse: [] } });
  }
  if (n === 'servidor') {
    const s = await infoServidor(env, g), c = s.crudo;
    return msg({ embeds: [{ color: ROSA, title: c.name, thumbnail: s.icono ? { url: s.icono } : undefined, description: c.description ? corto(c.description, 300) : undefined,
      fields: [{ name: 'Miembros', value: num(c.approximate_member_count), inline: true }, { name: 'En línea', value: num(c.approximate_presence_count), inline: true }, { name: 'Mejoras', value: num(c.premium_subscription_count), inline: true },
        { name: 'Creado', value: `${ts(creadoEl(g), 'D')} (${ts(creadoEl(g))})`, inline: true }, { name: 'Dueño', value: `<@${c.owner_id}>`, inline: true }, { name: 'Canales · roles', value: `${s.canales} · ${(c.roles || []).length}`, inline: true }] }], allowed_mentions: { parse: [] } });
  }
  if (n === 'usuario') {
    const { u, m } = elUsuario(it, op.usuario || yo.id);
    const f = await env.DB.prepare('SELECT xp, nivel FROM dc_xp WHERE guild = ?1 AND usuario = ?2').bind(g, u.id).first();
    return msg({ embeds: [{ color: VIOLETA, author: { name: nombreDe(u, m) }, thumbnail: { url: avatarDe(u) }, description: `<@${u.id}>${u.bot ? ' · bot' : ''}`,
      fields: [{ name: 'Cuenta creada', value: `${ts(creadoEl(u.id), 'D')} (${ts(creadoEl(u.id))})`, inline: true }, ...(m && m.joined_at ? [{ name: 'Entró al servidor', value: `${ts(Date.parse(m.joined_at), 'D')} (${ts(Date.parse(m.joined_at))})`, inline: true }] : []),
        { name: 'Nivel', value: f ? `${f.nivel} (${num(f.xp)} XP)` : '0', inline: true }, ...(m && m.roles && m.roles.length ? [{ name: `Roles (${m.roles.length})`, value: corto(m.roles.map((r) => `<@&${r}>`).join(' '), 1000) }] : [])] }], allowed_mentions: { parse: [] } });
  }
  // ---- de acá para abajo, sólo quien mandó el código de admin ----
  if (!(await esAdmin())) return efimero('Ese comando es para admins: primero mandame el código con /admin.');
  if (n === 'bienvenida') {
    if (sub === 'apagar') { await ajustar(env, g, 'bienvenida', null); avisarPuerta(g); return efimero('Listo: apagué la bienvenida.'); }
    if (sub === 'probar') {
      const b = (await ajustes(env, g)).bienvenida; if (!b || !b.canal) return efimero('Primero configurala: /bienvenida configurar.');
      const info = await infoServidor(env, g);
      try { await dc(env, 'POST', `/channels/${b.canal}/messages`, await tarjetaBienvenida(env, g, info, yo, it.member, { prueba: true })); }
      catch (e) { return efimero(`No pude escribir en <#${b.canal}> (${e.status || 'error'}): ¿el bot puede ver y escribir en ese canal?`); }
      return efimero(`Mandé una de prueba en <#${b.canal}>.`);
    }
    const nuevo = { canal: op.canal, mensaje: op.mensaje ? String(op.mensaje).slice(0, 1500) : null, despedida: !!op.despedida, privado: !!op.privado };
    await ajustar(env, g, 'bienvenida', nuevo); avisarPuerta(g);
    return efimero(`Listo: la bienvenida va en <#${nuevo.canal}>${nuevo.despedida ? ', con despedida' : ''}${nuevo.privado ? ' y un mensaje privado' : ''}. Probala con **/bienvenida probar**.${nuevo.mensaje ? '' : '\nUso el mensaje de fábrica; para uno propio: el campo «mensaje» con {usuario} {nombre} {servidor} {numero}.'}\nSi otro bot también da la bienvenida ahí, apagale la suya para que no salgan dos.`);
  }
  if (n === 'autorol') {
    const L = (await ajustes(env, g)).autorol || [];
    if (sub === 'ver') return efimero(L.length ? `Al entrar le doy: ${L.map((r) => `<@&${r}>`).join(', ')}.` : 'No hay roles automáticos. Agregá con /autorol agregar.');
    if (sub === 'quitar') { await ajustar(env, g, 'autorol', L.filter((r) => r !== op.rol)); avisarPuerta(g); return efimero(`Listo: <@&${op.rol}> ya no se da al entrar.`); }
    if (L.length >= 5 && !L.includes(op.rol)) return efimero('Ya hay 5 roles automáticos, que es el tope: sacá uno con /autorol quitar.');
    const p = await puedeDar(env, g, op.rol).catch(() => ({ ok: true }));
    if (!p.ok && p.por !== 'jerarquía') return efimero(avisoJerarquia(p));
    await ajustar(env, g, 'autorol', [...new Set([...L, op.rol])]); avisarPuerta(g);
    return efimero(`Listo: a cada persona que entre le doy <@&${op.rol}>.${p.ok ? '' : '\n**Ojo:** ' + avisoJerarquia(p) + ' Mientras tanto no puedo darlo.'}`);
  }
  if (n === 'niveles') {
    if (sub === 'crear') {
      ctx.waitUntil((async () => {
        const hechos = [];
        try {
          const hay = await dc(env, 'GET', `/guilds/${g}/roles`);
          for (const [nv, nom, color] of NIVELES_FABRICA) {
            const ya = hay.find((r) => r.name === nom) || await dc(env, 'POST', `/guilds/${g}/roles`, { name: nom, color, hoist: false, mentionable: false }, 'JXBot: /niveles crear');
            await env.DB.prepare('INSERT INTO dc_nivel_roles (guild, nivel, rol) VALUES (?1, ?2, ?3) ON CONFLICT(guild, nivel) DO UPDATE SET rol = ?3').bind(g, nv, ya.id).run();
            hechos.push(`nivel ${nv}: <@&${ya.id}>`);
          }
          await completar(env, it, { content: `**Listo, roles de premio:**\n${hechos.join('\n')}\nSe dan solos al llegar a cada nivel.` });
        } catch (e) { await completar(env, it, { content: `Hice ${hechos.length} de ${NIVELES_FABRICA.length}: ${corto(e.message, 200)}` }).catch(() => {}); }
      })());
      return diferido(true);
    }
    if (sub === 'recompensa') {
      const p = await puedeDar(env, g, op.rol).catch(() => ({ ok: true }));
      if (!p.ok && p.por !== 'jerarquía') return efimero(avisoJerarquia(p));
      await env.DB.prepare('INSERT INTO dc_nivel_roles (guild, nivel, rol) VALUES (?1, ?2, ?3) ON CONFLICT(guild, nivel) DO UPDATE SET rol = ?3').bind(g, op.nivel, op.rol).run();
      return efimero(`Listo: al llegar a nivel ${op.nivel} le doy <@&${op.rol}>.${p.ok ? '' : '\n**Ojo:** ' + avisoJerarquia(p)}`);
    }
    if (sub === 'quitar') { const r = await env.DB.prepare('DELETE FROM dc_nivel_roles WHERE guild = ?1 AND nivel = ?2').bind(g, op.nivel).run(); return efimero(r.meta && r.meta.changes ? `Listo: el nivel ${op.nivel} ya no da rol.` : `El nivel ${op.nivel} no tenía rol.`); }
    if (sub === 'avisos') {
      const nv = { avisos: op.activado !== false, canal: op.canal || null }; await ajustar(env, g, 'niveles', nv); avisarPuerta(g);
      return efimero(nv.avisos ? `Listo: aviso cuando alguien sube de nivel ${nv.canal ? `en <#${nv.canal}>` : 'en el mismo canal donde charla'}.` : 'Listo: no aviso cuando suben de nivel (los roles de premio se dan igual).');
    }
    const P = (await env.DB.prepare('SELECT nivel, rol FROM dc_nivel_roles WHERE guild = ?1 ORDER BY nivel').bind(g).all()).results, nv = (await ajustes(env, g)).niveles || {};
    return efimero(`**Roles de premio:** ${P.length ? '\n' + P.map((x) => `nivel ${x.nivel}: <@&${x.rol}>`).join('\n') : 'ninguno (/niveles recompensa, o /niveles crear para unos de fábrica)'}\n**Avisos al subir:** ${nv.avisos === false ? 'apagados' : nv.canal ? `en <#${nv.canal}>` : 'en el mismo canal'}`);
  }
  if (n === 'registro') {
    await ajustar(env, g, 'registro', op.canal || null); await ajustar(env, g, 'mods', op.canal && op.rol ? op.rol : null); avisarPuerta(g);
    return efimero(op.canal ? `Listo: entradas, salidas y lo que hagan los mods van a <#${op.canal}>.${op.rol ? ` Las alertas (3 warns, reportes) mencionan a <@&${op.rol}>.` : ''}` : 'Listo: apagué el registro.');
  }
  if (n === 'encuesta') {
    const ops = String(op.opciones || '').split(/[|;,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 10);
    if (ops.length < 2) return efimero('Poné al menos 2 opciones, separadas con coma o con |.');
    return msg({ poll: { question: { text: corto(op.pregunta, 300) }, answers: ops.map((t) => ({ poll_media: { text: corto(t, 55) } })), duration: Math.max(1, Math.min(768, op.horas || 24)), allow_multiselect: !!op.varias, layout_type: 1 } });
  }
  return null;
}

// el botón «Elegir roles» de la bienvenida: los mismos botones de /roles, pero que sólo los ve quien tocó
export function botonComunidad(it, ROLES) {
  if (it.data.custom_id !== 'roles:ver') return null;
  return efimero('Tocá para ponerte o sacarte un rol. **Avisos de versiones**: te menciono cuando sale algo nuevo.', { components: [{ type: 1, components: ROLES.map(([k, nom]) => ({ type: 2, style: k === 'avisos' ? 1 : 2, label: nom, custom_id: 'rol:' + k })) }] });
}

function ayuda() {
  return { color: ROSA, title: 'JXBot · comandos', description: 'Para hablarme: respondé a un mensaje mío, mencioname, escribí **/jb** y lo que quieras, o mandame un privado.',
    fields: [
      { name: 'Para todos', value: '/jb · /jxmod · /stickerazo · /estado · /bug · /sugerencia\n/nivel · /top · /servidor · /usuario · /warns · /limite · /ayuda' },
      { name: 'Admins (con el código de /admin)', value: '/configurar · /roles · /anunciar · /memoria\n/bienvenida · /autorol · /niveles · /registro · /encuesta' },
      { name: 'Moderación (con el código)', value: '/warn · /warns · /perdonar · /historial · /silenciar · /limpiar\n/expulsar · /ban · /desbanear · /lento · /bloquear · /desbloquear · /reiniciar-limite' },
      { name: 'Clic derecho en un mensaje → Apps', value: '«Reportar a los mods» (para todos) · «Warn por este mensaje» (mods)' }],
    footer: { text: 'Para hablarme: 7 s entre mensajes y 10 cada 30 min (admins y mods, sin límite)' } };
}

// ---- cómo se registran en Discord ----
const canalTexto = (name, description, required) => ({ type: 7, name, description, required, channel_types: [0, 5] });
export const COMANDOS_COMUNIDAD = [
  { name: 'ayuda', description: 'Todo lo que sabe hacer JXBot', dm_permission: true, contexts: [0, 1] },
  { name: 'nivel', description: 'Tu nivel y tu XP (o los de alguien)', dm_permission: false, options: [{ type: 6, name: 'usuario', description: 'De quién (si no, el tuyo)' }] },
  { name: 'top', description: 'Los 10 que más charlan en el servidor', dm_permission: false },
  { name: 'servidor', description: 'Datos del servidor', dm_permission: false },
  { name: 'usuario', description: 'Datos de alguien del servidor', dm_permission: false, options: [{ type: 6, name: 'usuario', description: 'Quién (si no, vos)' }] },
  { name: 'bienvenida', description: 'Admins: la bienvenida a los que entran', dm_permission: false, default_member_permissions: PERM.GESTIONAR_SERVIDOR, options: [
    { type: 1, name: 'configurar', description: 'Dónde y cómo dar la bienvenida', options: [canalTexto('canal', 'El canal de bienvenida', true),
      { type: 3, name: 'mensaje', description: 'Propio (opcional): {usuario} {nombre} {servidor} {numero}', max_length: 1500 },
      { type: 5, name: 'despedida', description: 'Avisar también cuando alguien se va' }, { type: 5, name: 'privado', description: 'Mandarle además un mensaje privado al que entra' }] },
    { type: 1, name: 'probar', description: 'Manda una de prueba con vos' }, { type: 1, name: 'apagar', description: 'Apaga la bienvenida' }] },
  { name: 'autorol', description: 'Admins: roles que se dan solos al entrar', dm_permission: false, default_member_permissions: PERM.GESTIONAR_SERVIDOR, options: [
    { type: 1, name: 'agregar', description: 'Dar este rol a cada uno que entre', options: [{ type: 8, name: 'rol', description: 'El rol', required: true }] },
    { type: 1, name: 'quitar', description: 'Dejar de darlo', options: [{ type: 8, name: 'rol', description: 'El rol', required: true }] },
    { type: 1, name: 'ver', description: 'Cuáles se dan' }] },
  { name: 'niveles', description: 'Admins: roles de premio por nivel y avisos al subir', dm_permission: false, default_member_permissions: PERM.GESTIONAR_SERVIDOR, options: [
    { type: 1, name: 'recompensa', description: 'Dar un rol al llegar a un nivel', options: [{ type: 4, name: 'nivel', description: 'El nivel', required: true, min_value: 1, max_value: 200 }, { type: 8, name: 'rol', description: 'El rol', required: true }] },
    { type: 1, name: 'quitar', description: 'Que un nivel no dé rol', options: [{ type: 4, name: 'nivel', description: 'El nivel', required: true, min_value: 1, max_value: 200 }] },
    { type: 1, name: 'crear', description: 'Crea roles de premio de fábrica (niveles 5, 10, 20, 35 y 50)' },
    { type: 1, name: 'avisos', description: 'Dónde avisar cuando alguien sube (o apagarlo)', options: [canalTexto('canal', 'Un canal fijo (si no, el mismo donde charla)', false), { type: 5, name: 'activado', description: 'Avisar (por defecto, sí)' }] },
    { type: 1, name: 'ver', description: 'Cómo está configurado' }] },
  { name: 'registro', description: 'Admins: canal con entradas, salidas, lo que hacen los mods y las alertas', dm_permission: false, default_member_permissions: PERM.GESTIONAR_SERVIDOR, options: [canalTexto('canal', 'El canal (sin canal: apagar)', false), { type: 8, name: 'rol', description: 'El rol de los mods, para mencionarlo en las alertas' }] },
  { name: 'encuesta', description: 'Admins: una encuesta de Discord', dm_permission: false, default_member_permissions: PERM.GESTIONAR_SERVIDOR, options: [
    { type: 3, name: 'pregunta', description: 'La pregunta', required: true, max_length: 300 }, { type: 3, name: 'opciones', description: 'Las opciones, separadas con coma o con | (de 2 a 10)', required: true, max_length: 600 },
    { type: 4, name: 'horas', description: 'Cuánto dura (por defecto 24)', min_value: 1, max_value: 768 }, { type: 5, name: 'varias', description: 'Se puede elegir más de una' }] },
];
