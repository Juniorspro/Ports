// ---------------- JXBot: la moderación ----------------
// Los warns (pedido del dueño): «/warn usuario» le da un warn y borra sus mensajes de los últimos 15 del canal, le escribe
// por privado y avisa en el canal. A los 3 les avisa a los admins (por privado a los que mandaron el código y en el
// registro, mencionando al rol de mods) con botones: banear, expulsar, silenciar un día o perdonar. «/perdonar» los
// vuelve a 0/3. «/warns» muestra los propios (los de otro, sólo admins), y la IA sabe los de quien le escribe, así que
// «¿tengo warns?» se contesta charlando (nunca los de otra persona).
// Además: /historial (todo lo que se le hizo a alguien), /silenciar, /limpiar, /expulsar, /ban, /desbanear, /lento
// (modo lento del canal), /bloquear y /desbloquear (nadie escribe en el canal), y con clic derecho en un mensaje
// «Reportar a los mods» (cualquiera, 5 por hora) y «Warn por este mensaje» (mods: pide el motivo, borra ese mensaje y
// los suyos de los últimos 15). Todo queda en dc_mod y en el registro.
// Los comandos piden el código de admin (los botones de las alertas también, aunque se toquen por privado) y Discord
// sólo se los muestra a quien tiene el permiso de Discord que corresponde.
import { dc, corto, msg, efimero, json, diferido, completar, usuarioDe, opciones, huellaCodigo, AMARILLO, VERDE, GRIS, ROJO, MIN } from './discord_base.js';
import { tablasCom, ajustes, registrar, creadoEl, nombreDe, avatarDe, PERM } from './discord_comunidad.js';

export const TOPE = 3;
const DIA = 86400e3, SEND = 1n << 11n, SEND_HILOS = 1n << 38n;
const ts = (ms, f = 'R') => `<t:${Math.floor(ms / 1000)}:${f}>`;

let listas = false;
export async function tablasMod(env) {
  if (listas) return; await tablasCom(env);
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_mod (id INTEGER PRIMARY KEY AUTOINCREMENT, guild TEXT, usuario TEXT, accion TEXT, motivo TEXT, autor TEXT, t INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_dc_mod ON dc_mod(guild, usuario, t)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dc_reportes (usuario TEXT, t INTEGER)'),
  ]);
  listas = true;
}
const anotar = (env, g, u, accion, motivo, autor) => env.DB.prepare('INSERT INTO dc_mod (guild, usuario, accion, motivo, autor, t) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(g, u, accion, corto(motivo || '', 500), autor || '', Date.now()).run();

// los warns de alguien (en un servidor, o en todos si no se dice): { n, L: [{ motivo, t }] }
export async function warnsDe(env, g, u) {
  await tablasMod(env);
  const L = (await (g ? env.DB.prepare('SELECT motivo, t FROM dc_avisos WHERE usuario = ?1 AND guild = ?2 ORDER BY t DESC').bind(u, g) : env.DB.prepare('SELECT motivo, t FROM dc_avisos WHERE usuario = ?1 ORDER BY t DESC').bind(u)).all()).results;
  return { n: L.length, L };
}
async function privado(env, uid, data) {
  try { const ch = await dc(env, 'POST', '/users/@me/channels', { recipient_id: uid }); await dc(env, 'POST', `/channels/${ch.id}/messages`, data); return true; } catch (e) { return false; }
}
// alerta para los admins: en el registro (mencionando al rol de mods) y por privado a los que mandaron el código
export async function alertarAdmins(env, g, data) {
  const aj = await ajustes(env, g), r = { registro: false, privados: 0 };
  if (aj.registro) {
    try { await dc(env, 'POST', `/channels/${aj.registro}/messages`, { ...data, content: aj.mods ? `<@&${aj.mods}>` : undefined, allowed_mentions: { roles: aj.mods ? [aj.mods] : [] } }); r.registro = true; }
    catch (e) { console.error('alerta registro', e.message); }
  }
  if (env.DISCORD_ADMIN_CODE) {
    const L = (await env.DB.prepare("SELECT DISTINCT usuario FROM dc_admins WHERE guild IN (?1, 'dm') AND huella = ?2 LIMIT 5").bind(g, await huellaCodigo(env)).all()).results;
    for (const a of L) if (await privado(env, a.usuario, data)) r.privados++;
  }
  return r;
}
// borra los mensajes de alguien entre los últimos 15 del canal (y uno puntual, si se pasa)
async function borrarDe(env, canal, uid, mensaje, motivo) {
  const L = await dc(env, 'GET', `/channels/${canal}/messages?limit=15`);
  const ids = new Set(L.filter((x) => x.author && x.author.id === uid).map((x) => x.id)); if (mensaje) ids.add(mensaje);
  const viejo = Date.now() - 13.9 * DIA, todos = [...ids], juntos = todos.filter((id) => creadoEl(id) > viejo), sueltos = todos.filter((id) => creadoEl(id) <= viejo);
  let n = 0;
  if (juntos.length >= 2) { await dc(env, 'POST', `/channels/${canal}/messages/bulk-delete`, { messages: juntos }, motivo); n += juntos.length; }
  else sueltos.push(...juntos);   // (de a uno: uno solo, o los de más de 14 días que Discord no deja borrar juntos)
  for (const id of sueltos) {
    try { await dc(env, 'DELETE', `/channels/${canal}/messages/${id}`, undefined, motivo); n++; }
    catch (e) { if (e.status === 403) throw e; }
  }
  return n;
}

// ---- las acciones (las usan los comandos y los botones de las alertas) ----
export async function darWarn(env, g, u, motivo, autor, { canal, mensaje } = {}) {
  await tablasMod(env); motivo = corto(motivo || 'sin motivo', 500);
  let borrados = 0, sinPermiso = false;
  if (canal) { try { borrados = await borrarDe(env, canal, u.id, mensaje, `JXBot: warn a ${u.username || u.id}`); } catch (e) { sinPermiso = e.status === 403; } }
  await env.DB.prepare('INSERT INTO dc_avisos (guild, usuario, motivo, autor, t) VALUES (?1, ?2, ?3, ?4, ?5)').bind(g, u.id, motivo, autor, Date.now()).run();
  await anotar(env, g, u.id, 'warn', motivo, autor);
  const { n } = await warnsDe(env, g, u.id);
  const priv = await privado(env, u.id, { embeds: [{ color: AMARILLO, title: `Recibiste un warn (${n}/${TOPE})`, description: `Motivo: **${motivo}**\n${n >= TOPE ? `Llegaste a ${TOPE}: un admin va a decidir qué pasa con tu cuenta.` : `A los ${TOPE}, un admin decide si te banea.`}`, footer: { text: 'JXBot · moderación' } }] });
  await registrar(env, g, { color: AMARILLO, description: `<@${autor}> le dio un warn a <@${u.id}> (**${n}/${TOPE}**): ${motivo}${borrados ? ` · borré ${borrados} mensaje${borrados === 1 ? '' : 's'} suyo${borrados === 1 ? '' : 's'}` : ''}${sinPermiso ? ' · no pude borrar (falta «Gestionar mensajes»)' : ''}` });
  const alerta = n >= TOPE ? await alertarAdmins(env, g, alertaTope(g, u, n, motivo)) : null;
  return { n, borrados, sinPermiso, priv, alerta };
}
function alertaTope(g, u, n, ultimo) {
  return { embeds: [{ color: ROJO, title: `${corto(nombreDe(u), 60)} llegó a ${n} warns`, thumbnail: { url: avatarDe(u, 128) },
    description: `<@${u.id}> tiene **${n}/${TOPE}** warns (el último: ${corto(ultimo, 300)}).\n¿Qué hacemos?`, footer: { text: 'Sólo los admins del bot pueden tocar los botones' }, timestamp: new Date().toISOString() }],
    components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Banear', custom_id: `mod:ban:${g}:${u.id}` }, { type: 2, style: 2, label: 'Expulsar', custom_id: `mod:kick:${g}:${u.id}` },
      { type: 2, style: 2, label: 'Silenciar 1 día', custom_id: `mod:sil:${g}:${u.id}` }, { type: 2, style: 3, label: `Perdonar (0/${TOPE})`, custom_id: `mod:perd:${g}:${u.id}` }] }] };
}
export async function perdonar(env, g, uid, autor, motivo) {
  await tablasMod(env);
  const r = await env.DB.prepare('DELETE FROM dc_avisos WHERE guild = ?1 AND usuario = ?2').bind(g, uid).run(), habia = (r.meta && r.meta.changes) || 0;
  await anotar(env, g, uid, 'perdon', motivo || `perdonado (${habia} warns)`, autor);
  await privado(env, uid, { embeds: [{ color: VERDE, title: 'Te perdonaron', description: `Tus warns volvieron a **0/${TOPE}**.${motivo ? `\n${corto(motivo, 300)}` : ''}`, footer: { text: 'JXBot · moderación' } }] });
  await registrar(env, g, { color: VERDE, description: `<@${autor}> perdonó a <@${uid}>: de ${habia} a 0/${TOPE} warns.` });
  return habia;
}
async function banear(env, g, uid, motivo, autor, borrarSeg = 0) {
  await privado(env, uid, { embeds: [{ color: ROJO, title: 'Te banearon del servidor', description: `Motivo: **${corto(motivo || 'sin motivo', 500)}**` }] });   // (antes: después ya no se puede)
  await dc(env, 'PUT', `/guilds/${g}/bans/${uid}`, { delete_message_seconds: borrarSeg }, `JXBot: ${corto(motivo || 'ban', 400)}`);
  await anotar(env, g, uid, 'ban', motivo, autor);
  await registrar(env, g, { color: ROJO, description: `<@${autor}> baneó a <@${uid}>${motivo ? ': ' + corto(motivo, 400) : ''}.` });
}
async function expulsar(env, g, uid, motivo, autor) {
  await privado(env, uid, { embeds: [{ color: ROJO, title: 'Te expulsaron del servidor', description: `Motivo: **${corto(motivo || 'sin motivo', 500)}**\nPodés volver a entrar con una invitación.` }] });
  await dc(env, 'DELETE', `/guilds/${g}/members/${uid}`, undefined, `JXBot: ${corto(motivo || 'expulsado', 400)}`);
  await anotar(env, g, uid, 'expulsion', motivo, autor);
  await registrar(env, g, { color: ROJO, description: `<@${autor}> expulsó a <@${uid}>${motivo ? ': ' + corto(motivo, 400) : ''}.` });
}
async function silenciar(env, g, uid, min, motivo, autor) {
  const hasta = min ? new Date(Date.now() + min * MIN).toISOString() : null;
  await dc(env, 'PATCH', `/guilds/${g}/members/${uid}`, { communication_disabled_until: hasta }, `JXBot: ${min ? 'silenciado' : 'sin silencio'}${motivo ? ': ' + corto(motivo, 300) : ''}`);
  await anotar(env, g, uid, min ? 'silencio' : 'sin silencio', min ? `${min} min${motivo ? ': ' + motivo : ''}` : motivo, autor);
  await registrar(env, g, { color: min ? ROJO : VERDE, description: min ? `<@${autor}> silenció a <@${uid}> por ${min} min${motivo ? ': ' + corto(motivo, 300) : ''}.` : `<@${autor}> le sacó el silencio a <@${uid}>.` });
  return hasta;
}
const sinPermisoTxt = (que) => `No puedo: le falta «${que}» al rol de JXBot (abrí el link nuevo para darle los permisos), o esa persona es admin o tiene un rol más alto que el del bot.`;
const tiempoTxt = (ms) => { const m = Math.round(ms / MIN); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };
export function warnsTexto(w, quien) {   // (lo que la IA sabe de los warns de quien le escribe)
  return `${quien} tiene ${w.n} de ${TOPE} warns${w.n ? ` (el último ${tiempoTxt(Date.now() - w.L[0].t)}: «${corto(w.L[0].motivo, 120)}»)` : ''}`;
}

// ---- los comandos ----
const MOD = new Set(['warn', 'warns', 'perdonar', 'historial', 'silenciar', 'limpiar', 'expulsar', 'ban', 'desbanear', 'lento', 'bloquear', 'desbloquear', 'Reportar a los mods', 'Warn por este mensaje']);
const elUsuario = (it, id) => { const R = (it.data && it.data.resolved) || {}; return (R.users || {})[id] || { id }; };
const soloDigitos = (s) => (String(s || '').match(/\d{15,22}/) || [])[0];

export async function comandoModeracion(env, it, ctx, { esAdmin }) {
  const n = it.data.name; if (!MOD.has(n)) return null;
  const g = it.guild_id, yo = usuarioDe(it), { op } = opciones(it);
  if (!g) return efimero('Usalo adentro de un servidor.');
  await tablasMod(env);
  if (n === 'Reportar a los mods') {   // (clic derecho en un mensaje: cualquiera)
    const m = ((it.data.resolved || {}).messages || {})[it.data.target_id];
    if (!m) return efimero('No encontré ese mensaje.');
    if (m.author.id === yo.id) return efimero('No te podés reportar a vos.');
    if (m.author.bot) return efimero('Ese mensaje es de un bot.');
    const ahora = Date.now(), c = await env.DB.prepare('SELECT COUNT(*) AS n FROM dc_reportes WHERE usuario = ?1 AND t > ?2').bind(yo.id, ahora - 3600e3).first();
    if (c && c.n >= 5) return efimero('Ya mandaste 5 reportes en la última hora. Probá más tarde.');
    await env.DB.prepare('INSERT INTO dc_reportes (usuario, t) VALUES (?1, ?2)').bind(yo.id, ahora).run();
    const link = `https://discord.com/channels/${g}/${m.channel_id}/${m.id}`, id = `${g}:${m.channel_id}:${m.id}:${m.author.id}`;
    const r = await alertarAdmins(env, g, { embeds: [{ color: AMARILLO, title: 'Reportaron un mensaje', author: { name: nombreDe(m.author), icon_url: avatarDe(m.author, 64) }, url: link,
      description: `${corto(m.content || '(sin texto: adjunto o sticker)', 1200)}\n\n[Ir al mensaje](${link}) · en <#${m.channel_id}> · de <@${m.author.id}>`, footer: { text: `Lo reportó ${yo.global_name || yo.username}` }, timestamp: new Date().toISOString() }],
      components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Warn y borrar', custom_id: 'rep:w:' + id }, { type: 2, style: 2, label: 'Sólo borrar', custom_id: 'rep:b:' + id }, { type: 2, style: 2, label: 'Ignorar', custom_id: 'rep:i:' + id }] }] });
    await anotar(env, g, m.author.id, 'reporte', corto(m.content, 200), yo.id);
    return efimero(r.registro || r.privados ? 'Gracias: se lo pasé a los mods.' : 'Gracias. (Ojo: no hay canal de registro ni admins del bot para avisarles; que un admin corra /registro.)');
  }
  if (n === 'warns') {   // (los propios, cualquiera; los de otro, sólo admins)
    const uid = op.usuario || yo.id;
    if (uid !== yo.id && !(await esAdmin())) return efimero('Sólo podés ver tus warns. Los de otros, los admins.');
    const w = await warnsDe(env, g, uid), tu = uid === yo.id;
    if (!w.n) return efimero(tu ? `No tenés warns: 0/${TOPE}.` : `<@${uid}> no tiene warns: 0/${TOPE}.`);
    return efimero(`${tu ? 'Tenés' : `<@${uid}> tiene`} **${w.n}/${TOPE}** warns:\n${w.L.slice(0, 10).map((x) => `› ${ts(x.t)}: ${corto(x.motivo, 150)}`).join('\n')}${w.n >= TOPE ? '\nLlegó a 3: un admin decide.' : ''}`);
  }
  // ---- de acá para abajo, sólo quien mandó el código de admin ----
  if (!(await esAdmin())) return efimero('Ese comando es para admins: primero mandame el código con /admin.');
  if (n === 'Warn por este mensaje') {
    const m = ((it.data.resolved || {}).messages || {})[it.data.target_id];
    if (!m || m.author.bot) return efimero('Ese mensaje no se puede (es de un bot o ya no está).');
    return json({ type: 9, data: { custom_id: `wm:${m.channel_id}:${m.id}:${m.author.id}`, title: `Warn a ${corto(nombreDe(m.author), 30)}`, components: [{ type: 1, components: [{ type: 4, custom_id: 'motivo', label: 'Motivo', style: 1, required: true, max_length: 300, placeholder: 'Por qué' }] }] } });
  }
  if (n === 'warn') {
    const u = elUsuario(it, op.usuario);
    if (u.bot) return efimero('A un bot no se le dan warns.');
    if (u.id === yo.id) return efimero('No te podés dar un warn a vos.');
    ctx.waitUntil(responderWarn(env, it, g, u, op.motivo, yo.id, { canal: it.channel_id }));
    return diferido(false);
  }
  if (n === 'perdonar') {
    const habia = await perdonar(env, g, op.usuario, yo.id, op.motivo);
    return efimero(habia ? `Listo: perdoné a <@${op.usuario}> (tenía ${habia}): vuelve a 0/${TOPE}.` : `<@${op.usuario}> no tenía warns.`);
  }
  if (n === 'historial') {
    const L = (await env.DB.prepare('SELECT accion, motivo, autor, t FROM dc_mod WHERE guild = ?1 AND usuario = ?2 ORDER BY t DESC LIMIT 15').bind(g, op.usuario).all()).results, w = await warnsDe(env, g, op.usuario);
    return efimero(`**Historial de <@${op.usuario}>** · warns ahora: **${w.n}/${TOPE}**\n${L.length ? L.map((x) => `› ${ts(x.t)} **${x.accion}**${x.motivo ? `: ${corto(x.motivo, 120)}` : ''}${x.autor ? ` (<@${x.autor}>)` : ''}`).join('\n') : 'Sin nada anotado.'}`);
  }
  if (n === 'silenciar') {
    const min = Math.max(0, Math.min(40320, op.minutos | 0));
    try { const hasta = await silenciar(env, g, op.usuario, min, op.motivo, yo.id); return efimero(min ? `Listo: <@${op.usuario}> no puede escribir hasta ${ts(Date.parse(hasta), 't')}.` : `Listo: <@${op.usuario}> ya puede escribir.`); }
    catch (e) { return efimero(e.status === 403 ? sinPermisoTxt('Aislar temporalmente a miembros') : 'No pude: ' + corto(e.message, 200)); }
  }
  if (n === 'limpiar') {
    try {
      const L = await dc(env, 'GET', `/channels/${it.channel_id}/messages?limit=100`), viejo = Date.now() - 13.9 * DIA;
      const ids = L.filter((x) => (!op.usuario || x.author.id === op.usuario) && creadoEl(x.id) > viejo).slice(0, op.cantidad).map((x) => x.id);
      if (!ids.length) return efimero('No encontré mensajes para borrar (Discord no deja borrar de a muchos los de más de 14 días).');
      if (ids.length === 1) await dc(env, 'DELETE', `/channels/${it.channel_id}/messages/${ids[0]}`, undefined, `JXBot: /limpiar de ${yo.username}`);
      else await dc(env, 'POST', `/channels/${it.channel_id}/messages/bulk-delete`, { messages: ids }, `JXBot: /limpiar de ${yo.username}`);
      await registrar(env, g, { color: AMARILLO, description: `<@${yo.id}> borró **${ids.length}** mensajes en <#${it.channel_id}>${op.usuario ? ` (de <@${op.usuario}>)` : ''}.` });
      return efimero(`Listo: borré ${ids.length} mensaje${ids.length === 1 ? '' : 's'}.`);
    } catch (e) { return efimero(e.status === 403 ? 'No tengo permiso para borrar mensajes acá: le falta «Gestionar mensajes» al rol de JXBot (abrí el link nuevo).' : 'No pude: ' + corto(e.message, 200)); }
  }
  if (n === 'expulsar' || n === 'ban') {
    const u = elUsuario(it, op.usuario);
    if (u.id === yo.id) return efimero('A vos no.');
    ctx.waitUntil((async () => {
      try { if (n === 'ban') await banear(env, g, u.id, op.motivo, yo.id, op.borrar || 0); else await expulsar(env, g, u.id, op.motivo, yo.id); await completar(env, it, { content: `Listo: <@${u.id}> ${n === 'ban' ? 'quedó baneado' : 'fue expulsado'}.` }); }
      catch (e) { await completar(env, it, { content: e.status === 403 ? sinPermisoTxt(n === 'ban' ? 'Banear miembros' : 'Expulsar miembros') : 'No pude: ' + corto(e.message, 200) }).catch(() => {}); }
    })());
    return diferido(true);
  }
  if (n === 'desbanear') {
    const uid = soloDigitos(op.usuario); if (!uid) return efimero('Pasame el ID de la persona (un número largo; se copia con clic derecho → Copiar ID).');
    try { await dc(env, 'DELETE', `/guilds/${g}/bans/${uid}`, undefined, `JXBot: desbaneado por ${yo.username}`); }
    catch (e) { return efimero(e.status === 404 ? 'Esa persona no está baneada.' : e.status === 403 ? sinPermisoTxt('Banear miembros') : 'No pude: ' + corto(e.message, 200)); }
    await anotar(env, g, uid, 'desban', op.motivo, yo.id); await registrar(env, g, { color: VERDE, description: `<@${yo.id}> desbaneó a <@${uid}>${op.motivo ? ': ' + corto(op.motivo, 300) : ''}.` });
    return efimero(`Listo: <@${uid}> ya puede volver (con una invitación).`);
  }
  if (n === 'lento') {
    const s = Math.max(0, Math.min(21600, op.segundos | 0));
    try { await dc(env, 'PATCH', `/channels/${it.channel_id}`, { rate_limit_per_user: s }, `JXBot: modo lento por ${yo.username}`); }
    catch (e) { return efimero(e.status === 403 ? 'No puedo: le falta «Gestionar canales» al rol de JXBot (abrí el link nuevo).' : 'No pude: ' + corto(e.message, 200)); }
    await registrar(env, g, { color: GRIS, description: s ? `<@${yo.id}> puso modo lento de ${s} s en <#${it.channel_id}>.` : `<@${yo.id}> sacó el modo lento de <#${it.channel_id}>.` });
    return efimero(s ? `Listo: en este canal se puede mandar un mensaje cada ${s} s.` : 'Listo: sin modo lento.');
  }
  if (n === 'bloquear' || n === 'desbloquear') {
    const cierra = n === 'bloquear';
    try {
      const ch = await dc(env, 'GET', `/channels/${it.channel_id}`), ow = (ch.permission_overwrites || []).find((o) => o.id === g) || { allow: '0', deny: '0' };
      let allow = BigInt(ow.allow), deny = BigInt(ow.deny);
      if (cierra) { deny |= SEND | SEND_HILOS; allow &= ~(SEND | SEND_HILOS); } else deny &= ~(SEND | SEND_HILOS);
      await dc(env, 'PUT', `/channels/${it.channel_id}/permissions/${g}`, { type: 0, allow: String(allow), deny: String(deny) }, `JXBot: ${n} por ${yo.username}`);
    } catch (e) { return efimero(e.status === 403 ? 'No puedo: le falta «Gestionar roles» en este canal al rol de JXBot.' : 'No pude: ' + corto(e.message, 200)); }
    await registrar(env, g, { color: cierra ? ROJO : VERDE, description: `<@${yo.id}> ${cierra ? 'bloqueó' : 'desbloqueó'} <#${it.channel_id}>${op.motivo ? ': ' + corto(op.motivo, 300) : ''}.` });
    return msg({ embeds: [{ color: cierra ? ROJO : VERDE, description: cierra ? `**Canal bloqueado** por los mods${op.motivo ? `: ${corto(op.motivo, 300)}` : ''}. Vuelve en un rato.` : '**Canal desbloqueado.** Ya se puede escribir.' }], allowed_mentions: { parse: [] } });
  }
  return null;
}
async function responderWarn(env, it, g, u, motivo, autor, donde) {
  try {
    const r = await darWarn(env, g, u, motivo, autor, donde);
    const pie = [r.borrados ? `Borré ${r.borrados} mensaje${r.borrados === 1 ? '' : 's'} suyo${r.borrados === 1 ? '' : 's'}` : r.sinPermiso ? 'No pude borrar sus mensajes (falta «Gestionar mensajes»)' : 'No había mensajes suyos entre los últimos 15',
      r.n >= TOPE ? (r.alerta && (r.alerta.registro || r.alerta.privados) ? 'Llegó a 3: ya les avisé a los admins' : 'Llegó a 3 (no hay registro ni admins para avisarles)') : `A los ${TOPE}, un admin decide si lo banea`];
    await completar(env, it, { content: `<@${u.id}>`, allowed_mentions: { users: [u.id] }, embeds: [{ color: r.n >= TOPE ? ROJO : AMARILLO, description: `<@${u.id}> recibió un **warn (${r.n}/${TOPE})**: ${corto(motivo, 500)}`, footer: { text: pie.join(' · ') } }] });
  } catch (e) { console.error('warn', e); await completar(env, it, { content: 'No pude terminar el warn: ' + corto(e.message, 200) }).catch(() => {}); }
}

// el formulario de «Warn por este mensaje»
export async function formularioModeracion(env, it, ctx, { esAdmin }) {
  const id = it.data.custom_id || ''; if (!id.startsWith('wm:')) return null;
  if (!(await esAdmin())) return efimero('Eso es para admins del bot.');
  const [, canal, mensaje, uid] = id.split(':'), v = {}; for (const f of it.data.components || []) for (const c of f.components || []) v[c.custom_id] = c.value;
  ctx.waitUntil(responderWarn(env, it, it.guild_id, { id: uid }, v.motivo, usuarioDe(it).id, { canal, mensaje }));
  return diferido(false);
}

// los botones de las alertas (3 warns y reportes), que pueden tocarse en el registro o por privado
export async function botonModeracion(env, it, { esAdminDe }) {
  const id = it.data.custom_id || ''; if (!id.startsWith('mod:') && !id.startsWith('rep:')) return null;
  const p = id.split(':'), yo = usuarioDe(it), g = p[2];
  if (!(await esAdminDe(env, yo.id, g))) return efimero('Sólo los admins del bot (los que mandaron el código con /admin) pueden decidir esto.');
  await tablasMod(env);
  let hecho;
  try {
    if (p[0] === 'mod') {
      const uid = p[3];
      if (p[1] === 'ban') { await banear(env, g, uid, `${TOPE} warns`, yo.id); hecho = 'baneado'; }
      else if (p[1] === 'kick') { await expulsar(env, g, uid, `${TOPE} warns`, yo.id); hecho = 'expulsado'; }
      else if (p[1] === 'sil') { await silenciar(env, g, uid, 1440, `${TOPE} warns`, yo.id); hecho = 'silenciado un día'; }
      else if (p[1] === 'perd') { await perdonar(env, g, uid, yo.id); hecho = `perdonado (0/${TOPE})`; }
    } else {
      const [, acc, , canal, mensaje, uid] = p;
      if (acc === 'w') { const r = await darWarn(env, g, { id: uid }, 'Mensaje reportado', yo.id, { canal, mensaje }); hecho = `warn ${r.n}/${TOPE} y ${r.borrados} mensaje${r.borrados === 1 ? '' : 's'} borrado${r.borrados === 1 ? '' : 's'}`; }
      else if (acc === 'b') { await dc(env, 'DELETE', `/channels/${canal}/messages/${mensaje}`, undefined, 'JXBot: mensaje reportado').catch((e) => { if (e.status !== 404) throw e; }); await anotar(env, g, uid, 'mensaje borrado', 'reportado', yo.id); hecho = 'mensaje borrado'; }
      else hecho = 'ignorado';
    }
  } catch (e) {
    return efimero(e.status === 403 ? sinPermisoTxt(p[1] === 'ban' ? 'Banear miembros' : p[1] === 'kick' ? 'Expulsar miembros' : p[1] === 'sil' ? 'Aislar temporalmente a miembros' : 'Gestionar mensajes') : 'No pude: ' + corto(e.message, 200));
  }
  // (el mensaje de la alerta queda resuelto: sin botones y con quién hizo qué)
  const embeds = ((it.message && it.message.embeds) || []).map((e, i) => (i ? e : { ...e, color: GRIS, fields: [...(e.fields || []), { name: 'Resuelto', value: `${hecho} · por <@${yo.id}> ${ts(Date.now())}` }] }));
  return json({ type: 7, data: { embeds, components: [], allowed_mentions: { parse: [] } } });
}

// ---- cómo se registran en Discord ----
export const COMANDOS_MODERACION = [
  { name: 'warn', description: 'Moderación: un warn (borra sus mensajes de los últimos 15; a los 3 avisa a los admins)', dm_permission: false, default_member_permissions: PERM.MODERAR, options: [
    { type: 6, name: 'usuario', description: 'A quién', required: true }, { type: 3, name: 'motivo', description: 'Por qué', required: true, max_length: 500 }] },
  { name: 'warns', description: 'Tus warns (o los de alguien, si sos admin)', dm_permission: false, options: [{ type: 6, name: 'usuario', description: 'De quién (sólo admins)' }] },
  { name: 'perdonar', description: 'Moderación: le borra los warns a alguien (vuelve a 0/3)', dm_permission: false, default_member_permissions: PERM.MODERAR, options: [
    { type: 6, name: 'usuario', description: 'A quién', required: true }, { type: 3, name: 'motivo', description: 'Un mensaje para esa persona (opcional)', max_length: 300 }] },
  { name: 'historial', description: 'Moderación: todo lo que se le hizo a alguien (warns, silencios, bans…)', dm_permission: false, default_member_permissions: PERM.MODERAR, options: [{ type: 6, name: 'usuario', description: 'De quién', required: true }] },
  { name: 'silenciar', description: 'Moderación: que alguien no pueda escribir por un rato (0 = sacarlo)', dm_permission: false, default_member_permissions: PERM.MODERAR, options: [
    { type: 6, name: 'usuario', description: 'A quién', required: true }, { type: 4, name: 'minutos', description: 'Cuántos minutos (0 lo saca; hasta 28 días)', required: true, min_value: 0, max_value: 40320 },
    { type: 3, name: 'motivo', description: 'Por qué', max_length: 300 }] },
  { name: 'limpiar', description: 'Moderación: borra los últimos mensajes de este canal', dm_permission: false, default_member_permissions: PERM.GESTIONAR_MENSAJES, options: [
    { type: 4, name: 'cantidad', description: 'Cuántos (1 a 100)', required: true, min_value: 1, max_value: 100 }, { type: 6, name: 'usuario', description: 'Sólo los de esta persona' }] },
  { name: 'expulsar', description: 'Moderación: saca a alguien del servidor (puede volver con invitación)', dm_permission: false, default_member_permissions: PERM.EXPULSAR, options: [
    { type: 6, name: 'usuario', description: 'A quién', required: true }, { type: 3, name: 'motivo', description: 'Por qué', max_length: 400 }] },
  { name: 'ban', description: 'Moderación: banea a alguien', dm_permission: false, default_member_permissions: PERM.BANEAR, options: [
    { type: 6, name: 'usuario', description: 'A quién', required: true }, { type: 3, name: 'motivo', description: 'Por qué', max_length: 400 },
    { type: 4, name: 'borrar', description: 'Borrar también sus mensajes de…', choices: [{ name: 'nada', value: 0 }, { name: 'la última hora', value: 3600 }, { name: 'el último día', value: 86400 }, { name: 'la última semana', value: 604800 }] }] },
  { name: 'desbanear', description: 'Moderación: le saca el ban a alguien', dm_permission: false, default_member_permissions: PERM.BANEAR, options: [
    { type: 3, name: 'usuario', description: 'El ID de la persona', required: true, max_length: 40 }, { type: 3, name: 'motivo', description: 'Por qué', max_length: 300 }] },
  { name: 'lento', description: 'Moderación: modo lento en este canal (0 lo saca)', dm_permission: false, default_member_permissions: PERM.GESTIONAR_CANALES, options: [
    { type: 4, name: 'segundos', description: 'Cada cuántos segundos se puede escribir (0 a 21600)', required: true, min_value: 0, max_value: 21600 }] },
  { name: 'bloquear', description: 'Moderación: nadie puede escribir en este canal', dm_permission: false, default_member_permissions: PERM.GESTIONAR_CANALES, options: [{ type: 3, name: 'motivo', description: 'Por qué (se muestra)', max_length: 300 }] },
  { name: 'desbloquear', description: 'Moderación: vuelve a dejar escribir en este canal', dm_permission: false, default_member_permissions: PERM.GESTIONAR_CANALES },
  { type: 3, name: 'Reportar a los mods', dm_permission: false },
  { type: 3, name: 'Warn por este mensaje', dm_permission: false, default_member_permissions: PERM.MODERAR },
];
