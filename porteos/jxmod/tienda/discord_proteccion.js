// ---------------- la protección de JXBot: anti-spam, anti-raid y los rangos (admins y mods puestos por el bot) ----------------
// Todo lo que llega por la puerta (discord_puerta.js: el gateway, con el texto de los mensajes y las entradas):
//   · Anti-spam (con los que no son mods): invitaciones a otros servidores (se borran; la segunda vez, aislado),
//     menciones en masa (6 o más personas o roles en un mensaje: borrado y 30 min aislado), inundar (7 mensajes en 8 s:
//     se borran y aislado), repetir lo mismo (4 veces en un minuto, en cualquier canal: igual) y links de cuentas de
//     menos de un día (se borran). Lo aislado sube con las reincidencias de la última hora: 5 min, 30 min, 6 h.
//   · Anti-raid: si entran 8 o más en un minuto, modo raid por 10 minutos: el nivel de verificación del servidor
//     pasa a «alto» (después vuelve al de antes), las cuentas de menos de 7 días que entren se expulsan, se borra lo
//     que escriban los que entraron durante el raid y se avisa en el registro (mencionando al rol de mods). Los mods lo
//     prenden y apagan a mano con /raid. Además, con «días mínimos» (/proteccion), las cuentas más nuevas que eso se
//     expulsan siempre.
//   · Rangos: quien tiene el código de admin (/admin) le da a otros el rango de admin del bot o de mod con /rango, sin
//     pasarles el código (y, si se elige, también un rol de Discord). Los admins con rango usan los comandos de admin;
//     los mods, los de moderación. Sólo los del código ponen y sacan rangos.
// Lo que se ajusta (/proteccion) queda en dc_ajustes («proteccion» y «rangos») de cada servidor.
import { dc } from './discord_base.js';
import { ajustes, ajustar, registrar, PERM } from './discord_comunidad.js';

export const PROT_DEF = { spam: true, raid: true, invitaciones: true, menciones: 6, dias: 0 };
export const protDe = (aj) => ({ ...PROT_DEF, ...((aj && aj.proteccion) || {}) });
const ROJO = 0xe5484d, NARANJA = 0xf2994a, GRIS_ = 0x8a8f98;
const INVITACION = /(discord\.gg|discord(?:app)?\.com\/invite|dsc\.gg)\/[a-z0-9-]+/i;
const LINK = /https?:\/\/\S+/i;
// la edad de una cuenta de Discord: su ID lleva adentro cuándo se creó (ms desde 2015)
export const edadCuenta = (id, ahora) => ahora - (Number(BigInt(id) >> 22n) + 1420070400000);
const DIA = 86400e3, AISLAR = [5 * 60, 30 * 60, 6 * 3600];
const normal = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---- lo que se recuerda (en la memoria de la puerta: se pierde si se reinicia, y está bien) ----
export class Proteccion {
  constructor() { this.msgs = new Map(); this.faltas = new Map(); this.entradas = new Map(); this.raids = new Map(); }
  /** ¿qué hacer con este mensaje? null, o { motivo, borrar: [ids por canal], aislar: segundos, aviso } */
  revisar(m, cfg, ahora, esMod) {
    if (!m.guild_id || !m.author || m.author.bot || esMod || !cfg.spam) return null;
    const k = m.guild_id + ':' + m.author.id;
    const h = this.msgs.get(k) || { t: [], ids: [], textos: [] }; this.msgs.set(k, h);
    h.t = h.t.filter((x) => ahora - x < 8e3); h.t.push(ahora);
    h.ids = h.ids.filter((x) => ahora - x.t < 60e3); h.ids.push({ t: ahora, id: m.id, canal: m.channel_id });
    const tx = normal(m.content); h.textos = h.textos.filter((x) => ahora - x.t < 60e3); if (tx) h.textos.push({ t: ahora, tx });
    const raid = this.raids.get(m.guild_id);
    if (raid && raid.hasta > ahora && raid.nuevos.has(m.author.id)) return { motivo: 'escribió durante el raid (entró hace poco)', borrar: [m], aislar: 0 };
    if (cfg.invitaciones && INVITACION.test(m.content || '')) { const f = this.falta(k, ahora, 'inv'); return { motivo: 'invitación a otro servidor', borrar: [m], aislar: f > 1 ? 30 * 60 : 0, aviso: 'acá no se pueden pasar invitaciones a otros servidores.' }; }
    const menciones = (m.mentions || []).filter((u) => !u.bot).length + (m.mention_roles || []).length + (m.mention_everyone ? 5 : 0);
    if (menciones >= cfg.menciones) { this.falta(k, ahora); return { motivo: `menciones en masa (${menciones})`, borrar: [m], aislar: 30 * 60, aviso: 'nada de mencionar a tanta gente junta.' }; }
    if (h.t.length >= 7) { const f = this.falta(k, ahora); const ids = h.ids.filter((x) => ahora - x.t < 10e3); h.t = []; return { motivo: `inundar el chat (${ids.length} mensajes en 8 s)`, borrar: ids.map((x) => ({ id: x.id, channel_id: x.canal })), aislar: AISLAR[Math.min(f, 3) - 1], aviso: 'más despacio, que se inunda el chat.' }; }
    if (tx && tx.length >= 3 && h.textos.filter((x) => x.tx === tx).length >= 4) { const f = this.falta(k, ahora); h.textos = h.textos.filter((x) => x.tx !== tx); return { motivo: 'repetir el mismo mensaje', borrar: [m], aislar: AISLAR[Math.min(f, 3) - 1], aviso: 'no repitas lo mismo, ya lo vimos.' }; }
    if (LINK.test(m.content || '') && edadCuenta(m.author.id, ahora) < DIA) return { motivo: 'link de una cuenta de menos de un día', borrar: [m], aislar: 0, aviso: 'las cuentas recién creadas todavía no pueden pasar links.' };
    return null;
  }
  /** una falta más (en la última hora): cuántas lleva */
  falta(k, ahora, tipo = '') { const kk = k + tipo; const f = (this.faltas.get(kk) || []).filter((x) => ahora - x < 3600e3); f.push(ahora); this.faltas.set(kk, f); return f.length; }
  /** alguien entró: ¿empieza un raid? ¿se lo expulsa? { raid: 'empieza'|null, expulsar: motivo|null } */
  entrada(g, user, cfg, ahora) {
    const e = (this.entradas.get(g) || []).filter((x) => ahora - x < 60e3); e.push(ahora); this.entradas.set(g, e);
    let raid = this.raids.get(g); let empieza = null;
    if (raid && raid.hasta <= ahora && !raid.manual) { this.raids.delete(g); raid = null; }
    if (cfg.raid && !raid && e.length >= 8) { raid = { desde: ahora, hasta: ahora + 10 * 60e3, nuevos: new Set(), manual: false, entradas: e.length }; this.raids.set(g, raid); empieza = 'empieza'; }
    const edad = edadCuenta(user.id, ahora);
    if (raid && raid.hasta > ahora) { raid.nuevos.add(user.id); if (edad < 7 * DIA) return { raid: empieza, expulsar: 'cuenta de menos de 7 días durante un raid' }; }
    if (cfg.dias > 0 && edad < cfg.dias * DIA) return { raid: empieza, expulsar: `cuenta de menos de ${cfg.dias} días` };
    return { raid: empieza, expulsar: null };
  }
  /** el raid a mano (/raid): on = true lo prende por `min` minutos */
  raidManual(g, on, ahora, min = 30) {
    if (!on) { const r = this.raids.get(g); this.raids.delete(g); return r || null; }
    const r = { desde: ahora, hasta: ahora + min * 60e3, nuevos: new Set(), manual: true, entradas: 0 }; this.raids.set(g, r); return r;
  }
  enRaid(g, ahora) { const r = this.raids.get(g); return !!(r && r.hasta > ahora); }
  /** los raids que ya terminaron (para volver la verificación a como estaba) */
  vencidos(ahora) { const o = []; for (const [g, r] of this.raids) if (r.hasta <= ahora) { o.push([g, r]); this.raids.delete(g); } return o; }
}

// ---- hacerlo en Discord ----
const motivo = (t) => 'JXBot: ' + t;
export async function aplicarMensaje(env, m, d) {
  const porCanal = new Map(); for (const x of d.borrar) { const c = x.channel_id || m.channel_id; porCanal.set(c, [...(porCanal.get(c) || []), x.id]); }
  for (const [c, ids] of porCanal) {
    try { if (ids.length === 1) await dc(env, 'DELETE', `/channels/${c}/messages/${ids[0]}`); else await dc(env, 'POST', `/channels/${c}/messages/bulk-delete`, { messages: [...new Set(ids)].slice(0, 100) }); }
    catch (e) { console.error('protección borrar', e.message); }
  }
  if (d.aislar > 0) {
    try { await dc(env, 'PATCH', `/guilds/${m.guild_id}/members/${m.author.id}`, { communication_disabled_until: new Date(Date.now() + d.aislar * 1e3).toISOString() }, motivo(d.motivo)); }
    catch (e) { console.error('protección aislar', e.message); }
  }
  if (d.aviso) {
    try {
      const a = await dc(env, 'POST', `/channels/${m.channel_id}/messages`, { content: `<@${m.author.id}>, ${d.aviso}${d.aislar > 0 ? ` Quedás en pausa ${durTxt(d.aislar)}.` : ''}`, allowed_mentions: { users: [m.author.id] } });
      if (a && a.id) setTimeout(() => dc(env, 'DELETE', `/channels/${m.channel_id}/messages/${a.id}`).catch(() => {}), 8e3);
    } catch (e) { /* sin permiso para escribir ahí: nada */ }
  }
  await registrar(env, m.guild_id, { title: 'Protección: mensaje borrado', color: NARANJA, description: `<@${m.author.id}> · ${d.motivo}${d.aislar > 0 ? ` · aislado ${durTxt(d.aislar)}` : ''}`,
    fields: m.content ? [{ name: 'Mensaje', value: String(m.content).slice(0, 900) }] : [] });
}
export const durTxt = (s) => s >= 3600 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 60)} min`;
// la verificación del servidor durante un raid (alta) y la de antes, para volver
export async function verificacion(env, g, nivel) {
  try { const s = await dc(env, 'GET', `/guilds/${g}`); const antes = s.verification_level; if (nivel != null && antes !== nivel) await dc(env, 'PATCH', `/guilds/${g}`, { verification_level: nivel }, motivo('modo raid')); return antes; }
  catch (e) { console.error('protección verificación', e.message); return null; }
}
export async function aplicarEntrada(env, g, member, r, prot) {
  const u = member.user || member;
  if (r.raid === 'empieza') {
    const raid = prot.raids.get(g); if (raid) raid.verifAntes = await verificacion(env, g, 3);
    const aj = await ajustes(env, g);
    await registrar(env, g, { title: 'Posible raid: modo raid por 10 minutos', color: ROJO,
      description: `Entraron ${raid ? raid.entradas : 8} cuentas en un minuto. Verificación del servidor en «alta», las cuentas de menos de 7 días que entren se expulsan y se borra lo que escriban los recién llegados. /raid desactivar lo corta.` });
    if (aj.registro && aj.mods) await dc(env, 'POST', `/channels/${aj.registro}/messages`, { content: `<@&${aj.mods}> ojo: posible raid.`, allowed_mentions: { roles: [aj.mods] } }).catch(() => {});
  }
  if (r.expulsar) {
    try { await dc(env, 'DELETE', `/guilds/${g}/members/${u.id}`, undefined, motivo(r.expulsar)); } catch (e) { console.error('protección expulsar', e.message); }
    await registrar(env, g, { title: 'Protección: expulsado al entrar', color: ROJO, description: `${u.username || u.id} (<@${u.id}>) · ${r.expulsar}` });
  }
}

// ---- los rangos que pone el bot (admins y mods sin el código) ----
export async function rangoDe(env, g, uid) { if (!g) return null; const aj = await ajustes(env, g); return (aj.rangos && aj.rangos[uid]) || null; }

// ---- los comandos: /proteccion, /raid y /rango ----
const op = (it) => { const o = it.data.options || []; const s = o[0] && o[0].type === 1 ? o[0] : null; return { sub: s ? s.name : null, v: Object.fromEntries((s ? s.options || [] : o).map((x) => [x.name, x.value])) }; };
const efimero = (content) => new Response(JSON.stringify({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } }), { headers: { 'Content-Type': 'application/json' } });
const SI = (b) => (b ? 'sí' : 'no');
export async function comandoProteccion(env, it, ctx, h) {
  const n = it.data.name, g = it.guild_id; if (!['proteccion', 'raid', 'rango'].includes(n)) return null;
  if (!g) return efimero('Eso es en un servidor.');
  const { sub, v } = op(it); const quien = (it.member && it.member.user) || it.user;
  if (n === 'rango') {
    if (!(await h.esAdminCodigo())) return efimero('Los rangos los ponen sólo los que tienen el código de admin (mandalo con /admin).');
    const aj = await ajustes(env, g); const rangos = { ...(aj.rangos || {}) };
    if (sub === 'ver') {
      const l = Object.entries(rangos); return efimero(l.length ? l.map(([u, r]) => `· <@${u}>: ${r === 'admin' ? 'admin del bot' : 'mod'}`).join('\n') : 'Nadie tiene rango todavía. /rango dar usuario: rango:');
    }
    const u = v.usuario; if (!u) return efimero('¿A quién?');
    if (sub === 'dar') {
      const r = v.rango === 'admin' ? 'admin' : 'mod'; rangos[u] = r; await ajustar(env, g, 'rangos', rangos); h.avisarPuerta && h.avisarPuerta(g);
      let extra = '';
      if (v.rol) { try { await dc(env, 'PUT', `/guilds/${g}/members/${u}/roles/${v.rol}`, undefined, motivo(`rango ${r} (lo dio ${quien.username})`)); extra = ` y el rol <@&${v.rol}>`; } catch (e) { extra = ` (el rol no lo pude dar: ${e.status === 403 ? 'mi rol tiene que estar más arriba que ése' : 'error'})`; } }
      await registrar(env, g, { title: 'Rango dado', color: 0x5865f2, description: `<@${quien.id}> le dio a <@${u}> el rango de ${r === 'admin' ? 'admin del bot' : 'mod'}${extra}.` });
      return efimero(`Listo: <@${u}> ahora es ${r === 'admin' ? 'admin del bot (los comandos de admin, sin el código)' : 'mod (los comandos de moderación)'}${extra}.`);
    }
    if (sub === 'quitar') {
      const tenia = rangos[u]; delete rangos[u]; await ajustar(env, g, 'rangos', Object.keys(rangos).length ? rangos : null); h.avisarPuerta && h.avisarPuerta(g);
      if (v.rol) await dc(env, 'DELETE', `/guilds/${g}/members/${u}/roles/${v.rol}`, undefined, motivo('rango quitado')).catch(() => {});
      await registrar(env, g, { title: 'Rango quitado', color: GRIS_, description: `<@${quien.id}> le sacó el rango a <@${u}>${tenia ? ` (era ${tenia})` : ''}.` });
      return efimero(tenia ? `Listo: <@${u}> ya no tiene rango.` : `<@${u}> no tenía rango.`);
    }
    return null;
  }
  if (n === 'proteccion') {
    if (!(await h.esAdmin())) return efimero('Eso es para admins del bot.');
    const aj = await ajustes(env, g); const p = protDe(aj);
    if (sub === 'configurar') {
      for (const k of ['spam', 'raid', 'invitaciones']) if (typeof v[k] === 'boolean') p[k] = v[k];
      if (Number.isFinite(v.menciones)) p.menciones = Math.max(3, Math.min(30, v.menciones));
      if (Number.isFinite(v.dias)) p.dias = Math.max(0, Math.min(60, v.dias));
      await ajustar(env, g, 'proteccion', p); h.avisarPuerta && h.avisarPuerta(g);
    }
    return efimero(`**Protección de este servidor**\n· Anti-spam (inundar, repetir, menciones en masa, links de cuentas nuevas): ${SI(p.spam)}\n· Invitaciones a otros servidores: ${p.invitaciones ? 'se borran' : 'se dejan'}\n· Menciones en masa desde: ${p.menciones}\n· Anti-raid (8 entradas en un minuto): ${SI(p.raid)}\n· Cuentas más nuevas que esto se expulsan al entrar: ${p.dias ? p.dias + ' días' : 'no'}\n${aj.registro ? '' : '(Poné un canal de registro con /registro para ver lo que hace.)'}`);
  }
  if (n === 'raid') {
    if (!(await h.esAdmin()) && !(await h.esMod())) return efimero('Eso es para mods y admins.');
    const on = sub === 'activar'; const min = Math.max(5, Math.min(240, Number(v.minutos) || 30));
    let r = null; try { r = h.puerta ? await (await h.puerta('/raid', { method: 'POST', body: JSON.stringify({ g, on, min }) })).json() : null; } catch (e) { /* sin puerta */ }
    await registrar(env, g, { title: on ? 'Modo raid prendido a mano' : 'Modo raid apagado', color: on ? ROJO : 0x3ba55c, description: `por <@${quien.id}>${on ? ` · ${min} min` : ''}` });
    return efimero(on ? `Modo raid prendido por ${min} min: verificación alta, cuentas de menos de 7 días afuera${r && r.ok === false ? ' (la conexión del bot no contestó: puede tardar un minuto)' : ''}.` : 'Modo raid apagado: la verificación vuelve a la de antes.');
  }
  return null;
}
export const COMANDOS_PROTECCION = [
  { name: 'proteccion', description: 'Admins: el anti-spam y el anti-raid de este servidor', dm_permission: false, default_member_permissions: PERM.GESTIONAR_SERVIDOR, options: [
    { type: 1, name: 'ver', description: 'Cómo está la protección ahora' },
    { type: 1, name: 'configurar', description: 'Prender, apagar o ajustar', options: [
      { type: 5, name: 'spam', description: 'Anti-spam: inundar, repetir, menciones en masa, links de cuentas nuevas' },
      { type: 5, name: 'invitaciones', description: 'Borrar invitaciones a otros servidores' },
      { type: 5, name: 'raid', description: 'Anti-raid: si entran 8 en un minuto, modo raid 10 min' },
      { type: 4, name: 'menciones', description: 'Cuántas menciones en un mensaje ya es spam (3 a 30; de fábrica 6)', min_value: 3, max_value: 30 },
      { type: 4, name: 'dias', description: 'Expulsar al entrar las cuentas más nuevas que estos días (0: no)', min_value: 0, max_value: 60 }] }] },
  { name: 'raid', description: 'Mods: prender o apagar el modo raid a mano', dm_permission: false, default_member_permissions: PERM.MODERAR, options: [
    { type: 1, name: 'activar', description: 'Verificación alta y afuera las cuentas nuevas que entren', options: [{ type: 4, name: 'minutos', description: 'Cuánto (5 a 240; de fábrica 30)', min_value: 5, max_value: 240 }] },
    { type: 1, name: 'desactivar', description: 'Volver a la normalidad' }] },
  { name: 'rango', description: 'Los del código de admin: dar o sacar el rango de admin del bot o de mod', dm_permission: false, default_member_permissions: PERM.GESTIONAR_SERVIDOR, options: [
    { type: 1, name: 'dar', description: 'Darle a alguien rango de admin del bot o de mod', options: [
      { type: 6, name: 'usuario', description: 'A quién', required: true },
      { type: 3, name: 'rango', description: 'Cuál', required: true, choices: [{ name: 'Admin del bot', value: 'admin' }, { name: 'Mod', value: 'mod' }] },
      { type: 8, name: 'rol', description: 'También darle este rol de Discord (opcional)' }] },
    { type: 1, name: 'quitar', description: 'Sacarle el rango', options: [{ type: 6, name: 'usuario', description: 'A quién', required: true }, { type: 8, name: 'rol', description: 'También sacarle este rol (opcional)' }] },
    { type: 1, name: 'ver', description: 'Quién tiene rango en este servidor' }] },
];
