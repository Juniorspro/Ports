// ---------------- lo común del bot de Discord (discord.js, discord_puerta.js y discord_comunidad.js) ----------------
// Aparte para que los módulos no se importen en círculo: la API de Discord con el token del bot, los colores de JXApps y
// las respuestas a las interacciones.
export const API = 'https://discord.com/api/v10';
export const REPO = 'https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/';
export const SITIO_SZ = 'https://stickerazo.pages.dev';
export const ROSA = 0xff3e8a, AMARILLO = 0xffd23f, VIOLETA = 0x7a3cff, VERDE = 0x2ecc71, GRIS = 0x8d88a3, ROJO = 0xff5a5f;
export const EFIMERO = 64, MIN = 60e3;
export const corto = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

// (fetch suelto: en Cloudflare, llamarlo como método de otro objeto —env.__fetch(…)— da «Illegal invocation», y adentro
// de la puerta env.__fetch ni existe; las pruebas ponen ahí su fetch de mentira)
export const traer = (env, url, op) => { const f = env.__fetch || fetch; return f(url, op); };
// ---- la API de Discord con el token del bot ----
export async function dc(env, metodo, ruta, cuerpo, motivo) {
  const h = { Authorization: 'Bot ' + env.DISCORD_TOKEN, 'User-Agent': 'DiscordBot (' + SITIO_SZ + ', 1.0)' };
  if (cuerpo !== undefined) h['Content-Type'] = 'application/json';
  if (motivo) h['X-Audit-Log-Reason'] = encodeURIComponent(motivo);
  const r = await traer(env, API + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = { texto: t }; }
  if (!r.ok) throw Object.assign(new Error(`Discord ${metodo} ${ruta}: ${r.status} ${corto(t, 200)}`), { status: r.status, d });
  return d;
}

// ---- las respuestas a una interacción ----
export const json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
export const msg = (data) => json({ type: 4, data });
export const efimero = (content, extra = {}) => msg({ content, flags: EFIMERO, allowed_mentions: { parse: [] }, ...extra });
export const diferido = (efi) => json({ type: 5, ...(efi ? { data: { flags: EFIMERO } } : {}) });
export const completar = (env, it, data) => dc(env, 'PATCH', `/webhooks/${env.DISCORD_APP_ID}/${it.token}/messages/@original`, { allowed_mentions: { parse: [] }, ...data });
export const usuarioDe = (it) => (it.member && it.member.user) || it.user || {};
// (las opciones de un comando o de su subcomando, como objeto)
export function opciones(it) {
  let L = (it.data && it.data.options) || [], sub = null;
  if (L[0] && (L[0].type === 1 || L[0].type === 2)) { sub = L[0].name; L = L[0].options || []; }
  return { sub, op: Object.fromEntries(L.map((o) => [o.name, o.value])) };
}
