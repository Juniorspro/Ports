// ---------------- la puerta: la conexión fija de JXBot con Discord (para el chat normal) ----------------
// Los comandos con / llegan por HTTP (discord.js), pero leer mensajes comunes necesita estar conectado al gateway de
// Discord todo el tiempo. Eso lo hace un Durable Object («PuertaDiscord», uno solo: «principal»): abre el WebSocket,
// late (heartbeat), se identifica y, cuando llega un mensaje, contesta con la IA (discord_ia.js):
//   · por mensaje privado al bot: todo; «/admin CÓDIGO» lo reconoce como admin (vale en todos los servidores);
//   · en un servidor: si empieza con /JB (o /jb), si lo mencionan o si le responden a un mensaje suyo;
//   · si alguien escribe «/admin CÓDIGO» en un canal (a la vista de todos), no lo toma, intenta borrarlo y avisa.
// Si se corta, una alarma cada minuto (y el cron de cada 10) la vuelve a abrir. Si Discord no deja leer el texto de
// los mensajes (el permiso «Message Content»), se conecta sin él: andan los privados y las menciones.
import { dc, probarCodigo, esAdminDe } from './discord.js';
import { respuestaIA } from './discord_ia.js';

const GATEWAY = 'https://gateway.discord.gg/?v=10&encoding=json';
const GUILD_MESSAGES = 1 << 9, DIRECT_MESSAGES = 1 << 12, MESSAGE_CONTENT = 1 << 15;
const NO_REINTENTAR = new Set([4004, 4010, 4011, 4012, 4013]);

// ---- qué hacer con un mensaje (aparte, para poder probarlo sin Discord) ----
export async function manejarMensaje(env, m, yo) {
  if (!m || !m.author || m.author.bot || m.author.id === yo || m.webhook_id) return null;
  const dm = !m.guild_id, mencion = (m.mentions || []).some((u) => u.id === yo) || new RegExp(`<@!?${yo}>`).test(m.content || '');
  const respuesta = m.referenced_message && m.referenced_message.author && m.referenced_message.author.id === yo;
  let t = String(m.content || '').replace(new RegExp(`<@!?${yo}>`, 'g'), ' ').trim();
  const jb = /^\/jb\b/i.test(t); if (jb) t = t.replace(/^\/jb\b[\s,:]*/i, '').trim();
  if (!dm && !jb && !mencion && !respuesta) return null;
  const responder = (content) => dc(env, 'POST', `/channels/${m.channel_id}/messages`, { content, allowed_mentions: { parse: [] }, ...(dm ? {} : { message_reference: { message_id: m.id, fail_if_not_exists: false } }) });
  // el código de admin escrito como mensaje
  const ad = /^\/?admin\s+(\S.*)$/i.exec(t);
  if (ad) {
    if (dm) { const r = await probarCodigo(env, m.author.id, null, ad[1]); await responder(r.texto); return { tipo: 'admin', ok: r.ok }; }
    await dc(env, 'DELETE', `/channels/${m.channel_id}/messages/${m.id}`, undefined, 'JXBot: código escrito en público').catch(() => {});
    await responder('No escribas el código en un canal: lo ve todo el mundo. Mandámelo por mensaje privado (o con /admin, que no lo ve nadie). Si ya lo leyó alguien, conviene cambiarlo.');
    return { tipo: 'admin-publico' };
  }
  if (!t) { await responder('¿Qué me querés preguntar? Escribí /JB y lo que quieras, o mencioname.'); return { tipo: 'vacio' }; }
  dc(env, 'POST', `/channels/${m.channel_id}/typing`).catch(() => {});
  const nombre = (m.member && m.member.nick) || m.author.global_name || m.author.username;
  const r = await respuestaIA(env, { canal: m.channel_id, usuario: m.author.id, nombre, texto: t, admin: await esAdminDe(env, m.author.id, m.guild_id) });
  await responder(r.espera || r.texto);
  return { tipo: 'ia', de: r.de || null };
}

async function abrirGateway() {
  const r = await fetch(GATEWAY, { headers: { Upgrade: 'websocket' } });
  if (!r.webSocket) throw new Error('el gateway no abrió el WebSocket: ' + r.status);
  r.webSocket.accept(); return r.webSocket;
}

export class PuertaDiscord {
  constructor(state, env) {
    this.state = state; this.env = env; this.ws = null; this.hb = null; this.seq = null; this.ack = true; this.yo = null;
    this.listo = false; this.ultimo = 0; this.sinContenido = false; this.parado = null; this.eventos = 0; this.mensajes = 0; this.desde = 0;
    this.abrir = env.__abrirWs || abrirGateway;
  }
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === '/asegurar') { await this.asegurar(); if (!(await this.state.storage.getAlarm())) await this.state.storage.setAlarm(Date.now() + 60e3); }
    return new Response(JSON.stringify({ conectado: !!(this.ws && this.listo), lee_texto: !this.sinContenido, desde: this.desde, eventos: this.eventos, mensajes: this.mensajes, parado: this.parado }), { headers: { 'Content-Type': 'application/json' } });
  }
  async alarm() { await this.asegurar(); await this.state.storage.setAlarm(Date.now() + 60e3); }
  async asegurar() {
    if (this.parado || !this.env.DISCORD_TOKEN) return;
    if (this.ws && Date.now() - this.ultimo < 120e3) return;
    await this.conectar();
  }
  async conectar() {
    this.cerrar();
    const ws = await this.abrir(); this.ws = ws; this.ultimo = Date.now(); this.listo = false; this.ack = true;
    ws.addEventListener('message', (e) => { if (this.ws === ws) this.evento(e.data).catch((er) => console.error('puerta evento', er)); });
    ws.addEventListener('close', (e) => {
      if (this.ws !== ws) return; this.ws = null; this.listo = false; clearInterval(this.hb);
      if (e.code === 4014 && !this.sinContenido) { this.sinContenido = true; this.conectar().catch(() => {}); return; }   // (sin permiso para leer el texto: sólo privados y menciones)
      if (NO_REINTENTAR.has(e.code)) { this.parado = 'Discord cerró con ' + e.code; return; }
      setTimeout(() => this.asegurar().catch(() => {}), 3000 + Math.random() * 4000);
    });
  }
  cerrar() { clearInterval(this.hb); if (this.ws) { const w = this.ws; this.ws = null; try { w.close(1000, 'reconecto'); } catch (e) { /* ya estaba */ } } }
  enviar(o) { if (this.ws) this.ws.send(JSON.stringify(o)); }
  latir() { if (!this.ack) { this.conectar().catch(() => {}); return; } this.ack = false; this.enviar({ op: 1, d: this.seq }); }
  async evento(data) {
    const p = JSON.parse(data); this.ultimo = Date.now(); this.eventos++;
    if (p.s != null) this.seq = p.s;
    if (p.op === 10) {
      clearInterval(this.hb); const cada = p.d.heartbeat_interval;
      setTimeout(() => this.latir(), Math.random() * cada); this.hb = setInterval(() => this.latir(), cada);
      this.enviar({ op: 2, d: { token: this.env.DISCORD_TOKEN, intents: GUILD_MESSAGES | DIRECT_MESSAGES | (this.sinContenido ? 0 : MESSAGE_CONTENT),
        properties: { os: 'linux', browser: 'jxbot', device: 'jxbot' },
        presence: { status: 'online', afk: false, since: null, activities: [{ type: 4, name: 'Custom Status', state: 'Escribí /JB y preguntame' }] } } });
    } else if (p.op === 11) this.ack = true;
    else if (p.op === 1) this.latir();
    else if (p.op === 7 || p.op === 9) { setTimeout(() => this.conectar().catch(() => {}), 1000 + Math.random() * 4000); }
    else if (p.op === 0) {
      if (p.t === 'READY') { this.yo = p.d.user.id; this.listo = true; this.desde = Date.now(); }
      else if (p.t === 'MESSAGE_CREATE') { this.mensajes++; manejarMensaje(this.env, p.d, this.yo).catch((e) => console.error('puerta mensaje', e)); }
    }
  }
}
