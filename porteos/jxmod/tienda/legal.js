// las páginas públicas que pide Google para publicar el inicio de sesión: la política de privacidad (/privacidad) y las
// condiciones del servicio (/condiciones), en español y en inglés. Dicen lo que de verdad hace la tienda (cuenta.js y
// social.js): qué se guarda de la cuenta de Google, para qué, y cómo borrarlo.
const CONTACTO = 'holasoyjuniors365@gmail.com';
const ESTILO = 'body{font:16px/1.55 system-ui,Roboto,Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px 18px 60px;color:#1f2328;background:#fff}h1{font-size:26px;margin:.2em 0 .1em}h2{font-size:19px;margin:1.6em 0 .4em}small{color:#666}li{margin:.25em 0}hr{border:0;border-top:1px solid #ddd;margin:36px 0}a{color:#1a6fd1}@media (prefers-color-scheme:dark){body{background:#15171b;color:#e8eaed}small{color:#9aa0a6}hr{border-color:#333}a{color:#7db4ff}}';
const PRIVACIDAD = `
<h1>JXMod · Política de privacidad</h1><small>Última actualización: 2 de noviembre de 2026</small>
<p>JXMod es un juego gratuito, sin fines de lucro, para jugar con amigos. Esta página explica qué datos usa cuando iniciás sesión con Google.</p>
<h2>Qué datos guardamos</h2>
<ul><li>De tu cuenta de Google: el identificador de cuenta, tu nombre y la foto de perfil. No pedimos ni guardamos tu contraseña, tus correos ni tus contactos.</li>
<li>Tu progreso del juego (construcciones guardadas, noches, ajustes de personaje y la lista de addons) para que puedas seguir en otro aparato.</li>
<li>Lo social: tu ID de jugador, el nombre que elijas, tu estado (en línea/desconectado), tus amigos, solicitudes, bloqueos y los mensajes de chats y grupos (se guardan los últimos 200 de cada chat).</li></ul>
<h2>Para qué</h2>
<p>Sólo para que funcionen el multijugador, el guardado del progreso y la sección social. No vendemos ni compartimos datos con nadie, no mostramos publicidad y no hacemos seguimiento.</p>
<h2>Dónde se guardan</h2>
<p>En la base de datos de la tienda del juego (Cloudflare). La sesión dura 90 días en tu aparato y podés cerrarla cuando quieras desde el juego.</p>
<h2>Borrar tus datos</h2>
<p>Escribinos a <a href="mailto:${CONTACTO}">${CONTACTO}</a> desde el correo de tu cuenta y borramos todo lo que tenga que ver con ella. También podés quitarle el acceso a JXMod en <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<h2>Menores</h2><p>Los mensajes pasan por un filtro de palabras y se pueden bloquear jugadores. Si sos menor, usalo con permiso de un adulto.</p>
<h2>Contacto</h2><p><a href="mailto:${CONTACTO}">${CONTACTO}</a></p>
<hr>
<h1>JXMod · Privacy Policy</h1><small>Last updated: November 2, 2026</small>
<p>JXMod is a free, non-profit game to play with friends. This page explains what data it uses when you sign in with Google.</p>
<h2>What we store</h2>
<ul><li>From your Google account: the account identifier, your name and profile picture. We never ask for or store your password, email messages or contacts.</li>
<li>Your game progress (saved builds, nights, character settings and your addon list) so you can continue on another device.</li>
<li>Social features: your player ID, chosen name, status (online/offline), friends, requests, blocks and chat/group messages (the latest 200 per chat).</li></ul>
<h2>Why</h2><p>Only to run multiplayer, cloud saves and the social section. We do not sell or share data, show ads or track you.</p>
<h2>Where</h2><p>In the game store's database (Cloudflare). Your session lasts 90 days on your device and you can sign out anytime in the game.</p>
<h2>Deleting your data</h2><p>Email <a href="mailto:${CONTACTO}">${CONTACTO}</a> from your account's address and we will delete everything related to it. You can also remove JXMod's access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACTO}">${CONTACTO}</a></p>`;
const CONDICIONES = `
<h1>JXMod · Condiciones del servicio</h1><small>Última actualización: 2 de noviembre de 2026</small>
<ul><li>JXMod es gratis y sin fines de lucro. Se ofrece «tal cual», sin garantías: puede tener errores o dejar de funcionar.</li>
<li>Al usar el multijugador y lo social te comprometés a tratar bien a los demás: nada de acoso, contenido ilegal, datos personales de otros ni spam. Podemos quitar el acceso a quien no lo respete.</li>
<li>Los addons del Workshop y los mapas de la comunidad son de sus autores; JXMod sólo los muestra para jugar.</li>
<li>Cómo usamos tus datos: ver la <a href="/privacidad">política de privacidad</a>.</li>
<li>Contacto: <a href="mailto:${CONTACTO}">${CONTACTO}</a></li></ul>
<hr>
<h1>JXMod · Terms of Service</h1><small>Last updated: November 2, 2026</small>
<ul><li>JXMod is free and non-profit. It is provided "as is", without warranty: it may have bugs or stop working.</li>
<li>When using multiplayer and social features you agree to treat others well: no harassment, illegal content, other people's personal data or spam. We may remove access for anyone who doesn't.</li>
<li>Workshop addons and community maps belong to their authors; JXMod only loads them to play.</li>
<li>How we use your data: see the <a href="/privacidad">privacy policy</a>.</li>
<li>Contact: <a href="mailto:${CONTACTO}">${CONTACTO}</a></li></ul>`;
const pagina = (titulo, cuerpo) => new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><style>${ESTILO}</style></head><body>${cuerpo}</body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'X-Content-Type-Options': 'nosniff' } });
// la respuesta, o null si la ruta no es de acá
export function legalRutas(req, r) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  if (r === '/privacidad' || r === '/privacy') return pagina('JXMod · Privacidad', PRIVACIDAD);
  if (r === '/condiciones' || r === '/terms') return pagina('JXMod · Condiciones', CONDICIONES);
  return null;
}
