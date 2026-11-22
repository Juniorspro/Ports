// Pone en marcha el bot de Discord de JXApps (tienda/discord.js) con sólo el token del bot (/root/.discord/token,
// chmod 600, nunca en el repo). Con el token, Discord da el ID y la clave pública de la aplicación; esta herramienta:
//   info       → muestra la aplicación (nombre, ID, clave pública) y deja ID y clave en /root/.discord/app.json
//   endpoint   → le dice a Discord a qué URL mandar los comandos (Discord la prueba con un PING firmado: el Worker ya
//                tiene que tener DISCORD_APP_ID, DISCORD_PUBLIC_KEY y DISCORD_TOKEN)
//   comandos   → registra los comandos de discord.js (COMANDOS)
//   avatar     → le pone de foto la imagen que se pase (por defecto, la de perfil de JXApps)
//   invitar    → el link para sumarlo a un servidor, con los permisos justos
// uso: node discord_bot.mjs info|endpoint|comandos|avatar [PNG]|invitar
import fs from 'fs';
const TOKEN = fs.readFileSync('/root/.discord/token', 'utf8').trim();
const URL_BOT = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/discord/interacciones';
const API = 'https://discord.com/api/v10', UA = 'DiscordBot (https://stickerazo.pages.dev, 1.0)';
async function dc(m, ruta, cuerpo) {
  const r = await fetch(API + ruta, { method: m, headers: { Authorization: 'Bot ' + TOKEN, 'User-Agent': UA, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(`${m} ${ruta}: ${r.status} ${t.slice(0, 300)}`); return t ? JSON.parse(t) : null;
}
const [, , que = 'info', extra] = process.argv;
if (que === 'info') {
  const a = await dc('GET', '/applications/@me');
  fs.writeFileSync('/root/.discord/app.json', JSON.stringify({ id: a.id, verify_key: a.verify_key, nombre: a.name }), { mode: 0o600 });
  console.log(JSON.stringify({ nombre: a.name, id: a.id, verify_key: a.verify_key, bot: a.bot && a.bot.username, servidores: a.approximate_guild_count, endpoint: a.interactions_endpoint_url || null }));
} else if (que === 'endpoint') {
  const a = await dc('PATCH', '/applications/@me', { interactions_endpoint_url: URL_BOT, description: 'El bot de JXApps: JXMod y Stickerazo. /jxmod, /stickerazo, /estado, /bug y /sugerencia.' });
  console.log('endpoint', a.interactions_endpoint_url);
} else if (que === 'comandos') {
  const { COMANDOS } = await import('../tienda/discord.js'); const a = JSON.parse(fs.readFileSync('/root/.discord/app.json', 'utf8'));
  const r = await dc('PUT', `/applications/${a.id}/commands`, COMANDOS); console.log('comandos', r.map((c) => '/' + c.name).join(' '));
} else if (que === 'avatar') {
  const png = fs.readFileSync(extra || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad/logo/kit/png/jxapps_perfil_512.png');
  const u = await dc('PATCH', '/users/@me', { avatar: 'data:image/png;base64,' + png.toString('base64') }); console.log('avatar', u.username, !!u.avatar);
} else if (que === 'invitar') {
  const a = JSON.parse(fs.readFileSync('/root/.discord/app.json', 'utf8'));
  // (ver canales, mandar mensajes, links con vista previa, leer el historial, gestionar roles —para los botones— y
  // gestionar el servidor —para crear las reglas de AutoMod—; nada de administrador)
  const permisos = (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 16n) | (1n << 28n) | (1n << 5n);
  console.log(`https://discord.com/oauth2/authorize?client_id=${a.id}&permissions=${permisos}&integration_type=0&scope=bot+applications.commands`);
}
