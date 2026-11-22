// El bot de Discord de JXApps (tienda/discord.js), probado sin Discord: firmas Ed25519 de verdad (una llave de prueba),
// la D1 de mentira y una API de Discord falsa que anota lo que el bot le pide.
//  1. sin firma o con firma mala: 401; el PING de Discord (cuando se guarda la URL en el portal): PONG;
//  2. /jxmod y /stickerazo: la versión que leen el juego y la app, con los links; /estado: quién juega ahora;
//  3. /bug abre el formulario; al mandarlo cae en el panel (pn_posts, el mismo de «Bugs y sugerencias») y en dc_posts;
//     un segundo enseguida: «esperá»; /sugerencia igual con tipo sug;
//  4. el código de admin: sin código no se puede /configurar (aunque tenga permisos de Discord); con el código mal,
//     no, y al sexto intento en una hora ni lo prueba; con el bueno, sí: canal de anuncios, 3 roles y 3 reglas de
//     AutoMod, y otra vez no las duplica; el código nunca queda guardado (sólo su huella); si cambia, se pierde;
//  5. /roles pone los botones; tocar uno pone el rol y tocarlo de nuevo lo saca;
//  6. el cron: con una versión nueva anuncia en el canal (mencionando «Avisos»), y la segunda vez no repite; cuando el
//     panel le contesta al bug, le avisa a quien lo mandó en ese canal, una sola vez;
//  7. /anunciar arma el anuncio y menciona el rol sólo si se pide.
//  9. la IA (con un Gemini de mentira): /jb contesta «pensando» y después completa; en el chat normal (la puerta),
//     por privado contesta todo y «/admin CÓDIGO» lo reconoce; en un servidor contesta a «/JB …», a una mención y a
//     una respuesta a un mensaje suyo, y a nada más; el código escrito en un canal no lo toma, lo intenta borrar y avisa;
//     de a un mensaje cada 3 s; los datos reales (versión) van en las instrucciones;
// 10. la puerta (un WebSocket de mentira): al saludo de Discord se identifica con privados, servidores y texto; READY;
//     un mensaje lo contesta; si Discord no deja leer el texto (4014) se reconecta sin ese permiso; sin el «ack» del
//     latido, reconecta;
// 11. la versión: con otra versión del Worker la puerta se reinicia; 12. el /jb lo completa la puerta;
// 13. el lore de JXMod va en las instrucciones, y la memoria de los admins (/memoria, /recordar por privado) también;
// 14. la cadena de modelos de Gemini: sin cupo, respuesta cortada, pregunta cortada;
// 15. rol automático y bienvenida (con lo que llega por la puerta: entrar, salir, el festejo cada 50, el registro);
// 16. niveles (XP, aviso al subir, roles de premio, /nivel, /top, /niveles crear); 17. moderación (/limpiar, /aviso,
//     /avisos, /silenciar); 18. /servidor, /usuario, /encuesta, /ayuda y cómo se registran los comandos;
// 17 (ahora). los warns: /warn borra y avisa, a los 3 alerta a los admins con botones, /warns, la IA, /perdonar;
// 19. /perdonar, /historial, /silenciar, /limpiar, /ban, /expulsar, /desbanear, /lento, /bloquear, reportar y warn
//     por mensaje (clic derecho) y los botones del reporte; 20. el límite para hablarle (7 s y 10 cada 30 min).
// uso: node discord_bot.mjs
import { d1 } from '../../stickerazo/pruebas/d1_falsa.mjs';
const M = await import('../tienda/discord.js');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const enc = new TextEncoder(), hex = (u) => [...new Uint8Array(u)].map((b) => b.toString(16).padStart(2, '0')).join('');
const par = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const pub = hex(await crypto.subtle.exportKey('raw', par.publicKey));
// la API de Discord de mentira y los archivos de versión
const llamadas = [], geminiPedidos = [], geminiModelos = [], geminiModos = {}; let roles = [{ id: 'r0', name: '@everyone' }], reglas = [], sigRol = 1, sigRegla = 1;
let VERSION = { codigo: 3911, version: '3.9.11', apk: 'https://x/JXMod.apk', web: 'https://x/web/', notas_es: 'Arreglos del 21/11' }, APP = { v: 26112190, nombre: '0.8' };
async function falso(url, op = {}) {
  const u = String(url), m = op.method || 'GET', b = op.body ? JSON.parse(op.body) : undefined;
  if (u.includes('generativelanguage.googleapis.com')) {
    const modelo = /models\/([^:]+):/.exec(u)[1], modo = geminiModos[modelo]; geminiModelos.push(modelo);
    if (modo === 'dia') return new Response(JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }), { status: 429 });
    if (modo === 'minuto') return new Response(JSON.stringify({ error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2s' }] } }), { status: 429 });
    if (modo === 'cortada') return new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }));
    if (modo === 'pregunta') return new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }));
  }
  if (u.includes('generativelanguage.googleapis.com')) { const q = JSON.parse(op.body); geminiPedidos.push(q); const ult = q.contents[q.contents.length - 1].parts[0].text; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Respuesta IA a: ' + ult }] } }] })); }
  if (u.includes('web/version.json')) return new Response(JSON.stringify(VERSION));
  if (u.includes('descargas/app.json')) return new Response(JSON.stringify(APP));
  if (!u.startsWith('https://discord.com/api/v10')) return new Response('?', { status: 404 });
  const ruta = u.slice('https://discord.com/api/v10'.length); llamadas.push({ m, ruta, b, auth: (op.headers || {}).Authorization });
  if (ruta.startsWith(`/guilds/${G}`) || ruta.startsWith('/channels/') || ruta === '/users/@me/channels') { const r = comunidadFalsa(m, ruta, b); if (r) return r; }
  if (/\/roles$/.test(ruta) && m === 'GET') return new Response(JSON.stringify(roles));
  if (/\/roles$/.test(ruta) && m === 'POST') { const r = { id: 'r' + sigRol++, ...b }; roles.push(r); return new Response(JSON.stringify(r)); }
  if (/auto-moderation\/rules$/.test(ruta) && m === 'GET') return new Response(JSON.stringify(reglas));
  if (/auto-moderation\/rules$/.test(ruta) && m === 'POST') { const r = { id: 'a' + sigRegla++, ...b }; reglas.push(r); return new Response(JSON.stringify(r)); }
  return new Response(JSON.stringify({ id: 'm1' }));
}
// (lo de la comunidad: un servidor con IDs de verdad —números—, porque la jerarquía y las fechas salen de ellos)
const G = '1400000000000000001', idDe = (n) => String(1400000000000000000n + BigInt(n));
const idAhora = (ms = Date.now()) => String((BigInt(ms) - 1420070400000n) << 22n);
const rolesG = [{ id: G, name: '@everyone', position: 0 }, { id: idDe(200), name: 'Miembro', position: 1 }, { id: idDe(300), name: 'JXBot', position: 1, managed: true }, { id: idDe(500), name: 'Nuevo', position: 1 }];
const prohibidos = new Set([idDe(200)]); let sinPermisoBorrar = false, sigRolG = 600;
const mensajesCanal = [1, 2, 3, 4, 5, 6].map((i) => ({ id: idAhora(Date.now() - i * 60e3), author: { id: i % 3 === 0 ? idDe(900) : i % 2 ? idDe(700) : idDe(701) } }));
function comunidadFalsa(m, ruta, b) {
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status });
  if (ruta === `/guilds/${G}/roles` && m === 'GET') return j(rolesG);
  if (ruta === `/guilds/${G}/roles` && m === 'POST') { const r = { id: idDe(sigRolG++), position: 1, ...b }; rolesG.push(r); return j(r); }
  if (ruta === `/guilds/${G}/members/app1`) return j({ roles: [idDe(300)] });
  if (/^\/guilds\/\d+\/members\/\d+\/roles\/\d+$/.test(ruta) && prohibidos.has(ruta.split('/').pop())) return j({ message: 'Missing Permissions', code: 50013 }, 403);
  if (ruta.startsWith(`/guilds/${G}?with_counts`)) return j({ id: G, name: 'JXMod', icon: 'abc', owner_id: idDe(100), approximate_member_count: 349, approximate_presence_count: 12, premium_subscription_count: 2, roles: rolesG, rules_channel_id: '9001' });
  if (ruta === `/guilds/${G}/channels`) return j([{ id: '9001', type: 0, name: 'reglas' }, { id: '9002', type: 0, name: 'actualizaciones-y-descarga' }, { id: '9003', type: 0, name: 'bievenida' }]);
  if (/^\/channels\/\d+\/messages\?limit/.test(ruta)) return j(mensajesCanal);
  if (/bulk-delete$/.test(ruta) && sinPermisoBorrar) return j({ message: 'Missing Permissions' }, 403);
  if (ruta === '/users/@me/channels') return j({ id: 'dm-' + b.recipient_id });
  if (ruta === '/channels/9100' && m === 'GET') return j({ id: '9100', permission_overwrites: [{ id: G, type: 0, allow: String(1n << 11n), deny: '64' }] });
  if (ruta === `/guilds/${G}/bans/${idDe(951)}` && m === 'DELETE') return j({ message: 'Unknown Ban' }, 404);
  return null;
}
// (como en Cloudflare: fetch llamado como método de otro objeto —env.__fetch(…)— da «Illegal invocation»)
function estricto(...a) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation: fetch llamado como método'); return falso(...a); }
const env = { DB: d1(), DISCORD_APP_ID: 'app1', DISCORD_PUBLIC_KEY: pub, DISCORD_TOKEN: 'tok', DISCORD_ADMIN_CODE: 'Prueba(@1', GEMINI_KEY: 'gk', IA_ESPERA_MS: 3000, __fetch: estricto };   // (la espera entre mensajes, más corta que los 7 s de verdad: la 20 prueba ésos)
globalThis.fetch = estricto;   // (la IA y la puerta usan fetch directo)
const pendientes = []; const ctx = { waitUntil: (p) => pendientes.push(p) };
async function pedir(cuerpo, { firma = true, mala = false } = {}) {
  const txt = JSON.stringify(cuerpo), ts = String(Math.floor(Date.now() / 1000));
  const sig = hex(await crypto.subtle.sign('Ed25519', par.privateKey, enc.encode(ts + (mala ? txt + ' ' : txt))));
  const h = { 'Content-Type': 'application/json' }; if (firma) { h['X-Signature-Ed25519'] = sig; h['X-Signature-Timestamp'] = ts; }
  const req = new Request('https://w/api/discord/interacciones', { method: 'POST', headers: h, body: txt });
  const res = await M.discordRutas(req, env, new URL(req.url), '/api/discord/interacciones', ctx);
  let d = null; try { d = await res.json(); } catch (e) { /* texto */ }
  return { status: res.status, d };
}
const ADMIN = { user: { id: 'u1', username: 'dueño' }, permissions: String(0x20), roles: [] };
const NADIE = { user: { id: 'u2', username: 'pepe', global_name: 'Pepe' }, permissions: '0', roles: [] };
const cmd = (name, member = NADIE, options) => ({ type: 2, guild_id: 'g1', channel_id: 'c1', token: 'tk', member, data: { name, options } });

// 1
let r = await pedir({ type: 1 }, { firma: false }); const r2 = await pedir({ type: 1 }, { mala: true }); const r3 = await pedir({ type: 1 });
ok('1. sin firma 401, firma mala 401, PING con firma → PONG', r.status === 401 && r2.status === 401 && r3.status === 200 && r3.d.type === 1, [r.status, r2.status, r3.d]);
// 2
r = await pedir(cmd('jxmod')); const e = r.d && r.d.data.embeds[0];
const rs = await pedir(cmd('stickerazo')); const es = rs.d && rs.d.data.embeds[0];
await env.DB.prepare("INSERT INTO pn_presencia (d, nombre, version, plat, mapa, sala, visto, primero, ip) VALUES ('a','x','3.9.11','web','gm_construct','s1',?1,?1,''),('b','y','3.9.11','apk','gm_construct','',?1,?1,''),('c','z','3.9.10','web','FlatGrass','',?1,?1,'')").bind(Date.now()).run();
const re = await pedir(cmd('estado')); const ee = re.d && re.d.data.embeds[0];
ok('2. /jxmod (3.9.11 con APK y web), /stickerazo (0.8 con la página) y /estado (3 jugando, 1 sala, gm_construct arriba)',
  e && /3\.9\.11/.test(e.title) && JSON.stringify(e.fields).includes('JXMod.apk') && es && /0\.8/.test(es.title) && es.url.includes('stickerazo.pages.dev') && ee && ee.fields[0].value === '3' && ee.fields[1].value === '1' && /gm_construct\*\* · 2/.test(ee.fields[3].value),
  { jx: e && e.title, sz: es && es.title, estado: ee && ee.fields.map((f) => f.value) });
// 3
r = await pedir(cmd('bug'));
const formu = { type: 5, guild_id: 'g1', channel_id: 'c1', member: NADIE, data: { custom_id: 'bug', components: [['titulo', 'El mapa no tiene texturas'], ['texto', 'Entro a gm_x y todo violeta'], ['lugar', 'gm_x'], ['version', '3.9.11']].map(([id, v]) => ({ type: 1, components: [{ type: 4, custom_id: id, value: v }] })) } };
const rf = await pedir(formu); const post = await env.DB.prepare("SELECT * FROM pn_posts WHERE autor = 'dc:u2'").first(); const dp = await env.DB.prepare('SELECT * FROM dc_posts').first();
const rf2 = await pedir(formu);
const sug = await pedir({ ...formu, member: { ...NADIE, user: { id: 'u3', username: 'otro' } }, data: { custom_id: 'sug', components: [{ type: 1, components: [{ type: 4, custom_id: 'titulo', value: 'Modo carreras' }] }, { type: 1, components: [{ type: 4, custom_id: 'texto', value: 'Con autos' }] }] } });
const s2 = await env.DB.prepare("SELECT tipo FROM pn_posts WHERE autor = 'dc:u3'").first();
ok('3. /bug abre el formulario; mandado cae en el panel con lugar y versión, y un segundo enseguida dice «esperá»; /sugerencia queda como sug',
  r.d.type === 9 && r.d.data.components.length === 4 && rf.d.type === 4 && post && post.tipo === 'bug' && post.lugar === 'gm_x' && post.version === '3.9.11' && post.nombre === 'Pepe' && dp && dp.usuario === 'u2' && /Esperá/.test(rf2.d.data.content) && s2 && s2.tipo === 'sug',
  { modal: r.d.type, post: post && [post.tipo, post.titulo, post.lugar, post.version, post.nombre], segundo: rf2.d && rf2.d.data.content });
// 4
const codigo = (member, valor) => pedir({ type: 5, guild_id: 'g1', channel_id: 'c1', member, data: { custom_id: 'admin', components: [{ type: 1, components: [{ type: 4, custom_id: 'codigo', value: valor }] }] } });
const rn = await pedir(cmd('configurar', ADMIN));   // (tiene «gestionar servidor» en Discord, pero no mandó el código)
const ma = await pedir(cmd('admin', NADIE));
const mal = []; for (let i = 0; i < 6; i++) mal.push((await codigo(NADIE, 'nop' + i)).d.data.content);
const bienTarde = await codigo(NADIE, 'Prueba(@1');   // (ya gastó los 5 intentos de la hora)
const bien = await codigo(ADMIN, '  Prueba(@1 ');
const guardado = JSON.stringify((await env.DB.prepare('SELECT * FROM dc_admins').all()).results);
r = await pedir(cmd('configurar', ADMIN)); await Promise.all(pendientes.splice(0));
const c1 = await env.DB.prepare('SELECT * FROM dc_conf').first(); const n1 = [roles.length, reglas.length];
await pedir(cmd('configurar', ADMIN)); await Promise.all(pendientes.splice(0)); const n2 = [roles.length, reglas.length];
const fin = llamadas.filter((x) => x.m === 'PATCH' && x.ruta.includes('/webhooks/app1/tk/messages/@original')).pop();
ok('4a. código de admin: sin código no; /admin abre el formulario; 5 mal y el sexto ni se prueba (ni con el bueno); con el bueno (con espacios) sí; guarda la huella, no el código',
  /código con \/admin/.test(rn.d.data.content) && ma.d.type === 9 && /incorrecto/.test(mal[0]) && /Demasiados/.test(mal[5]) && /Demasiados/.test(bienTarde.d.data.content) && /ya sos admin/.test(bien.d.data.content) && !guardado.includes('Prueba'),
  { sin: rn.d.data.content, mal: [mal[0], mal[4], mal[5]], tarde: bienTarde.d.data.content, bien: bien.d.data.content });
ok('4. con el código: canal c1, 3 roles, 3 reglas de AutoMod (insultos/sexual, spam, menciones) y la segunda vez no duplica',
  r.d.type === 5 && c1 && c1.canal === 'c1' && n1[0] === 4 && n1[1] === 3 && n2[0] === 4 && n2[1] === 3 && reglas.some((x) => x.trigger_type === 4) && reglas.some((x) => x.trigger_type === 3) && reglas.some((x) => x.trigger_type === 5) && fin && /Listo/.test(fin.b.content),
  { roles: roles.map((x) => x.name), reglas: reglas.map((x) => x.trigger_type), segunda: n2, conf: c1 && [c1.canal, c1.ult_jxmod, c1.ult_sz] });
// 5
r = await pedir(cmd('roles', ADMIN)); const rolesConf = JSON.parse(c1.roles);
const b1 = await pedir({ type: 3, guild_id: 'g1', channel_id: 'c1', member: NADIE, data: { custom_id: 'rol:avisos' } });
const put = llamadas.filter((x) => x.m === 'PUT' && x.ruta.includes('/members/u2/roles/' + rolesConf.avisos)).length;
const b2 = await pedir({ type: 3, guild_id: 'g1', channel_id: 'c1', member: { ...NADIE, roles: [rolesConf.avisos] }, data: { custom_id: 'rol:avisos' } });
const del = llamadas.filter((x) => x.m === 'DELETE' && x.ruta.includes('/members/u2/roles/' + rolesConf.avisos)).length;
ok('5. /roles pone 3 botones; tocar «Avisos» pone el rol y tocarlo con el rol puesto lo saca', r.d.data.components[0].components.length === 3 && put === 1 && del === 1 && /ya tenés/.test(b1.d.data.content) && /saqué/.test(b2.d.data.content),
  { botones: r.d.data.components[0].components.map((x) => x.label), b1: b1.d.data.content, b2: b2.d.data.content });
// 6
const antes = llamadas.length; await M.discordCron(env); const nada = llamadas.slice(antes).filter((x) => x.m === 'POST' && x.ruta === '/channels/c1/messages').length;
VERSION = { ...VERSION, codigo: 3912, version: '3.9.12', notas_es: 'La luz de las manos' }; APP = { v: 26112191, nombre: '0.9' };
const a2 = llamadas.length; await M.discordCron(env); const anuncios = llamadas.slice(a2).filter((x) => x.m === 'POST' && x.ruta === '/channels/c1/messages');
const a3 = llamadas.length; await M.discordCron(env); const repite = llamadas.slice(a3).filter((x) => x.m === 'POST' && x.ruta === '/channels/c1/messages').length;
await env.DB.prepare("UPDATE pn_posts SET estado = 'hecho', respuesta = 'Arreglado en la 3.9.12' WHERE id = ?1").bind(post.id).run();
const a4 = llamadas.length; await M.discordCron(env); const aviso = llamadas.slice(a4).filter((x) => x.m === 'POST' && x.ruta === '/channels/c1/messages');
const a5 = llamadas.length; await M.discordCron(env); const aviso2 = llamadas.slice(a5).filter((x) => x.m === 'POST').length;
ok('6. cron: sin novedad no anuncia; con 3.9.12 y Stickerazo 0.9 anuncia las dos mencionando «Avisos», no repite; el bug contestado le avisa a quien lo mandó, una vez',
  nada === 0 && anuncios.length === 2 && anuncios[0].b.content === `<@&${rolesConf.avisos}>` && /3\.9\.12/.test(anuncios[0].b.embeds[0].title) && /0\.9/.test(anuncios[1].b.embeds[0].title) && repite === 0
    && aviso.length === 1 && aviso[0].b.content === '<@u2>' && /Hecho/.test(JSON.stringify(aviso[0].b.embeds[0].fields)) && /3\.9\.12/.test(JSON.stringify(aviso[0].b.embeds[0].fields)) && aviso2 === 0 && aviso[0].auth === 'Bot tok',
  { anuncios: anuncios.map((x) => x.b.embeds[0].title), aviso: aviso[0] && aviso[0].b.embeds[0].title, repite, aviso2 });
// 7
const an1 = await pedir(cmd('anunciar', ADMIN, [{ name: 'titulo', value: 'Evento' }, { name: 'texto', value: 'Sábado a las 18' }]));
const an2 = await pedir(cmd('anunciar', ADMIN, [{ name: 'titulo', value: 'Evento' }, { name: 'texto', value: 'Sábado' }, { name: 'avisar', value: true }]));
ok('7. /anunciar arma el anuncio; menciona «Avisos» sólo si se pide', an1.d.data.embeds[0].title === 'Evento' && !an1.d.data.content && an2.d.data.content === `<@&${rolesConf.avisos}>`, [an1.d.data.content, an2.d.data.content]);
// (por mensaje privado al bot: sin servidor; vale en todos)
const OTRO = { user: { id: 'u5', username: 'mod' }, permissions: '0', roles: [] };
const dmAntes = await pedir(cmd('anunciar', OTRO, [{ name: 'titulo', value: 'a' }, { name: 'texto', value: 'b' }]));
const dm = await pedir({ type: 5, user: { id: 'u5', username: 'mod' }, channel_id: 'dm5', data: { custom_id: 'admin', components: [{ type: 1, components: [{ type: 4, custom_id: 'codigo', value: 'Prueba(@1' }] }] } });
const dmDespues = await pedir(cmd('anunciar', OTRO, [{ name: 'titulo', value: 'a' }, { name: 'texto', value: 'b' }]));
ok('7b. /admin por mensaje privado al bot: después anda en el servidor', /primero mandame/.test(dmAntes.d.data.content) && /todos los servidores/.test(dm.d.data.content) && dmDespues.d.data.embeds && dmDespues.d.data.embeds[0].title === 'a', [dm.d.data.content]);
env.DISCORD_ADMIN_CODE = 'OtroCodigo!'; const tras = await pedir(cmd('anunciar', ADMIN, [{ name: 'titulo', value: 'x' }, { name: 'texto', value: 'y' }]));
ok('8. si el código cambia, el que se habilitó con el anterior deja de ser admin', /primero mandame el código/.test(tras.d.data.content), tras.d.data.content);
// 9
env.DISCORD_ADMIN_CODE = 'Prueba(@1';
const P = await import('../tienda/discord_puerta.js');
const { __fetch: _x, ...envDO } = env;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const rj = await pedir(cmd('jb', NADIE, [{ name: 'mensaje', value: '¿Qué trae la última versión?' }])); await Promise.all(pendientes.splice(0));
const pj = llamadas.filter((x) => x.m === 'PATCH' && x.ruta.includes('/webhooks/app1/tk/messages/@original')).pop();
const sis = geminiPedidos[geminiPedidos.length - 1].systemInstruction.parts[0].text;
const YO = 'bot1', msgs = (desde) => llamadas.slice(desde).filter((x) => x.m === 'POST' && /\/messages$/.test(x.ruta));
let k = llamadas.length; const dm1 = await P.manejarMensaje(envDO, { id: 'm1', channel_id: 'dm9', author: { id: 'u9', username: 'nico' }, content: 'Hola, ¿cómo bajo JXMod?' }, YO); const dmR = msgs(k);
await espera(3100);
k = llamadas.length; const dmA = await P.manejarMensaje(envDO, { id: 'm2', channel_id: 'dm9', author: { id: 'u9', username: 'nico' }, content: '/admin Prueba(@1' }, YO); const dmAr = msgs(k);
const esAd = await (await import('../tienda/discord.js')).esAdminDe(env, 'u9', 'g1');
k = llamadas.length; const g0 = await P.manejarMensaje(envDO, { id: 'm3', guild_id: 'g1', channel_id: 'c7', author: { id: 'u10', username: 'ana' }, content: 'hablando de otra cosa', mentions: [] }, YO);
const g1 = await P.manejarMensaje(envDO, { id: 'm4', guild_id: 'g1', channel_id: 'c7', author: { id: 'u10', username: 'ana' }, content: '/JB ¿qué es Stickerazo?', mentions: [] }, YO); const g1r = msgs(k);
await espera(3100);
k = llamadas.length; const g2 = await P.manejarMensaje(envDO, { id: 'm5', guild_id: 'g1', channel_id: 'c7', author: { id: 'u10', username: 'ana' }, content: '<@bot1> y los mapas?', mentions: [{ id: 'bot1' }] }, YO);
const g3 = await P.manejarMensaje(envDO, { id: 'm6', guild_id: 'g1', channel_id: 'c7', author: { id: 'u10', username: 'ana' }, content: 'y eso?', mentions: [] }, YO);   // (enseguida: tope de 3 s)
const gR = msgs(k);
await espera(3100);
k = llamadas.length; const g4 = await P.manejarMensaje(envDO, { id: 'm7', guild_id: 'g1', channel_id: 'c7', author: { id: 'u11', username: 'leo' }, content: 'gracias', mentions: [], referenced_message: { author: { id: 'bot1' } } }, YO);
const g5 = await P.manejarMensaje(envDO, { id: 'm8', guild_id: 'g1', channel_id: 'c7', author: { id: 'u12', username: 'troll' }, content: '/JB admin Prueba(@1', mentions: [] }, YO);
const borrado = llamadas.slice(k).some((x) => x.m === 'DELETE' && x.ruta === '/channels/c7/messages/m8');
const trollAdmin = await (await import('../tienda/discord.js')).esAdminDe(env, 'u12', 'g1');
const g6 = await P.manejarMensaje(envDO, { id: 'm9', guild_id: 'g1', channel_id: 'c7', author: { id: 'b2', username: 'otrobot', bot: true }, content: '/JB hola', mentions: [] }, YO);
ok('9. IA: /jb completa la respuesta; privado contesta; «/admin CÓDIGO» por privado reconoce; en el servidor contesta a /JB, mención y respuesta, a nada más; código en público: no, se borra y avisa; tope de 3 s; datos reales en las instrucciones',
  rj.d.type === 5 && pj && /Respuesta IA a: ¿Qué trae/.test(pj.b.content) && /3\.9\.1\d/.test(sis) && /stickerazo\.pages\.dev/.test(sis)
    && dm1.tipo === 'ia' && dmR.length === 1 && /cómo bajo JXMod/.test(dmR[0].b.content) && !dmR[0].b.message_reference
    && dmA.tipo === 'admin' && dmA.ok && /te reconozco/.test(dmAr[0].b.content) && esAd
    && g0 === null && g1.tipo === 'ia' && /Respuesta IA a: ¿qué es Stickerazo\?/.test(g1r[0].b.content) && g1r[0].b.message_reference.message_id === 'm4'
    && g2.tipo === 'ia' && /a: y los mapas\?/.test(gR[0].b.content) && g3 === null && g4.tipo === 'ia' && g5.tipo === 'admin-publico' && borrado && !trollAdmin && g6 === null,
  { jb: pj && pj.b.content.slice(0, 80), dm: dmR[0] && dmR[0].b.content.slice(0, 60), admin: dmAr[0] && dmAr[0].b.content.slice(0, 50), g: [g0, g1 && g1.tipo, g2 && g2.tipo, g3, g4 && g4.tipo, g5 && g5.tipo, g6], tope: gR.length });
// 10
class WsFalso extends EventTarget { constructor() { super(); this.enviados = []; this.cerrado = null; } send(x) { this.enviados.push(JSON.parse(x)); } close(c) { this.cerrado = c; } recibir(o) { this.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(o) })); } cortar(code) { this.dispatchEvent(Object.assign(new Event('close'), { code })); } }
const socks = []; let alarma = null;
const est = { storage: { getAlarm: async () => alarma, setAlarm: async (t) => { alarma = t; } } };
const { __fetch: _sinFetch, ...envPuerta } = env;   // (el Durable Object no tiene __fetch: usa el fetch global)
const pu = new P.PuertaJX(est, { ...envPuerta, __abrirWs: async () => { const w = new WsFalso(); socks.push(w); return w; } });
const e0 = await (await pu.fetch(new Request('https://puerta/asegurar'))).json();
socks[0].recibir({ op: 10, d: { heartbeat_interval: 40000 } }); await espera(10);
const ident = socks[0].enviados.find((x) => x.op === 2);
socks[0].recibir({ op: 0, t: 'READY', s: 1, d: { user: { id: 'bot1' }, session_id: 's' } }); await espera(10);
const e1 = await (await pu.fetch(new Request('https://puerta/estado'))).json();
k = llamadas.length; socks[0].recibir({ op: 0, t: 'MESSAGE_CREATE', s: 2, d: { id: 'm20', guild_id: 'g1', channel_id: 'c8', author: { id: 'u20', username: 'sol' }, content: '/jb hola bot', mentions: [] } }); await espera(80);
const viaPuerta = msgs(k);
socks[0].cortar(4014); await espera(20); socks[1].recibir({ op: 10, d: { heartbeat_interval: 40000 } }); await espera(10);
const ident2 = socks[1].enviados.find((x) => x.op === 2);
socks[1].cortar(4014); await espera(20); socks[2].recibir({ op: 10, d: { heartbeat_interval: 40000 } }); await espera(10);
const ident3 = socks[2].enviados.find((x) => x.op === 2);
pu.ack = false; pu.latir(); await espera(20);
const BASE = (1 << 0) | (1 << 9) | (1 << 12);   // servidores, mensajes de servidores y privados
ok('10. puerta: se identifica (servidores, miembros, mensajes, privados y texto) con «Escribí /JB»; READY; el mensaje /jb se contesta; con 4014 se reconecta sin miembros y, con otro, sin texto; sin ack, reconecta',
  e0 && alarma && ident && ident.d.intents === (BASE | (1 << 1) | (1 << 15)) && ident.d.token === 'tok' && /\/JB/.test(ident.d.presence.activities[0].state) && e1.conectado && viaPuerta.length === 1 && /hola bot/.test(viaPuerta[0].b.content)
    && ident2 && ident2.d.intents === (BASE | (1 << 15)) && ident3 && ident3.d.intents === BASE && socks.length === 4,
  { intents: [ident && ident.d.intents, ident2 && ident2.d.intents, ident3 && ident3.d.intents], conectado: e1.conectado, sockets: socks.length });
// 11: la versión: si el Worker le pasa otra, la puerta cierra y se reinicia
let abortado = null; const est2 = { storage: est.storage, abort: (m) => { abortado = m; throw new Error('abortado: ' + m); } };
const pv = new P.PuertaJX(est2, { ...envPuerta, CF_VERSION_METADATA: { id: 'v1' }, __abrirWs: async () => { const w = new WsFalso(); socks.push(w); return w; } });
const misma = await (await pv.fetch(new Request('https://puerta/estado?v=v1'))).json();
let otra = null; try { await pv.fetch(new Request('https://puerta/asegurar?v=v2')); } catch (e) { otra = e.message; }
ok('11. la puerta con la misma versión sigue; con otra versión cierra la conexión y se reinicia', misma.version === 'v1' && /abortado/.test(otra || '') && /versión nueva/.test(abortado || '') && pv.ws === null, { misma: misma.version, otra });
// 12: /jb hecho por la puerta: el Worker le pasa el trabajo y la puerta completa el «pensando…»
await espera(3100);
k = llamadas.length;
const rp = await pu.fetch(new Request('https://puerta/jb', { method: 'POST', body: JSON.stringify({ token: 'tkjb', canal: 'c9', guild: 'g1', usuario: 'u30', nombre: 'Lu', texto: '¿Hay modo carreras?' }) }));
await espera(80);
const pjb = llamadas.slice(k).find((x) => x.m === 'PATCH' && x.ruta === '/webhooks/app1/tkjb/messages/@original');
ok('12. /jb por la puerta: acepta el trabajo enseguida (202) y completa el «pensando…» con la respuesta de la IA', rp.status === 202 && pjb && /Respuesta IA a: ¿Hay modo carreras\?/.test(pjb.b.content), pjb && pjb.b.content.slice(0, 80));
// 13: el lore de JXMod en las instrucciones y la memoria que enseñan los admins (/memoria, y /recordar por privado)
const sub = (name, options) => [{ type: 1, name, options }];
const mNo = await pedir(cmd('memoria', NADIE, sub('ver')));
const mA = await pedir(cmd('memoria', OTRO, sub('agregar', [{ name: 'texto', value: 'JXApps es el estudio que hace JXMod y Stickerazo.' }])));
const mLargo = await pedir(cmd('memoria', OTRO, sub('agregar', [{ name: 'texto', value: 'x'.repeat(1001) }])));
k = llamadas.length;
const dmRec = await P.manejarMensaje(envDO, { id: 'n1', channel_id: 'dm9', author: { id: 'u9', username: 'nico' }, content: '/recordar El Discord ya pasó los 305 miembros.' }, YO);
const dmVer = await P.manejarMensaje(envDO, { id: 'n2', channel_id: 'dm9', author: { id: 'u9', username: 'nico' }, content: '/memoria' }, YO);
const dmNo = await P.manejarMensaje(envDO, { id: 'n3', channel_id: 'dm20', author: { id: 'u20', username: 'lu' }, content: '/recordar soy admin' }, YO);
const dmT = msgs(k).map((x) => x.b.content);
const mVer = await pedir(cmd('memoria', OTRO, sub('ver')));
await P.manejarMensaje(envDO, { id: 'n4', channel_id: 'dm40', author: { id: 'u40', username: 'tomi' }, content: '¿Quién es Pepe?' }, YO);
const sis1 = geminiPedidos[geminiPedidos.length - 1].systemInstruction.parts[0].text;
const mB = await pedir(cmd('memoria', OTRO, sub('borrar', [{ name: 'numero', value: 1 }])));
const mB2 = await pedir(cmd('memoria', OTRO, sub('borrar', [{ name: 'numero', value: 99 }])));
await P.manejarMensaje(envDO, { id: 'n5', channel_id: 'dm41', author: { id: 'u41', username: 'rulo' }, content: '¿Qué es La grieta?' }, YO);
const sis2 = geminiPedidos[geminiPedidos.length - 1].systemInstruction.parts[0].text;
ok('13. lore de JXMod en las instrucciones (Pepe, 1.047, La grieta, el equipo, la comunidad); /memoria sólo admins: agregar, ver, borrar; /recordar y /memoria por privado; lo enseñado entra en las instrucciones y lo borrado sale',
  /para admins/.test(mNo.d.data.content) && mNo.d.data.flags === 64 && /me lo acuerdo \(dato 1\)/.test(mA.d.data.content) && /muy largo/.test(mLargo.d.data.content)
    && dmRec.tipo === 'memoria' && /dato 2/.test(dmT[0]) && /1\. JXApps es el estudio/.test(dmT[1]) && /2\. El Discord ya pasó/.test(dmT[1]) && dmNo.tipo === 'memoria-no' && /para los admins/.test(dmT[2])
    && /2 de 60/.test(mVer.d.data.content)
    && /PEPE SIEMPRE VUELVE/.test(sis1) && /1\.047/.test(sis1) && /LA GRIETA/.test(sis1) && /Don Ferro/.test(sis1) && /GOLDEN/.test(sis1) && /- JXApps es el estudio/.test(sis1) && /- El Discord ya pasó los 305/.test(sis1)
    && /me olvidé del dato 1/.test(mB.d.data.content) && /No tengo ningún dato 99/.test(mB2.d.data.content) && !/JXApps es el estudio/.test(sis2) && /305 miembros/.test(sis2),
  { largo: sis1.length, ver: dmT[1] && dmT[1].slice(0, 120), no: mNo.d.data.content });
// 14: los modelos de respaldo: sin cupo del día → el siguiente y no se lo vuelve a probar; sin cupo del minuto → vuelve
// a los pocos segundos; respuesta cortada por seguridad → el siguiente; todos la cortan o la pregunta misma → «no», sin
// preguntarle a Workers AI
let usoAI = 0; envDO.AI = { run: async () => { usoAI++; return { response: 'Workers AI' }; } };
const preguntar = async (u, texto) => { geminiModelos.length = 0; const r = await P.manejarMensaje(envDO, { id: 'q' + u, channel_id: 'dmq' + u, author: { id: u, username: u }, content: texto }, YO); return { r, mods: geminiModelos.slice(), txt: llamadas[llamadas.length - 1].b.content }; };
Object.assign(geminiModos, { 'gemini-3.8-flash': 'dia', 'gemini-3.6-flash': 'minuto', 'gemini-3.5-flash': 'cortada' });
const q1 = await preguntar('u50', 'hola');
const q2 = await preguntar('u51', 'hola');
await espera(3100);
delete geminiModos['gemini-3.6-flash']; const q3 = await preguntar('u52', 'hola');
for (const m of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']) geminiModos[m] = 'cortada';
const q4 = await preguntar('u53', 'algo feo');
geminiModos['gemini-3.6-flash'] = 'pregunta'; const q5 = await preguntar('u54', 'algo peor');
for (const k of Object.keys(geminiModos)) delete geminiModos[k];
ok('14. respaldo de modelos: sin cupo del día se saltea; del minuto vuelve enseguida; cortada → el siguiente; todos cortan o la pregunta cortada → «no» sin Workers AI',
  q1.mods.join() === 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite' && /Respuesta IA a: hola/.test(q1.txt)
    && q2.mods.join() === 'gemini-3.5-flash,gemini-3.5-flash-lite' && q3.mods.join() === 'gemini-3.6-flash' && /Respuesta IA/.test(q3.txt)
    && /no puedo hablar/.test(q4.txt) && q4.mods.length === 4 && /no puedo hablar/.test(q5.txt) && q5.mods.join() === 'gemini-3.6-flash' && usoAI === 0,
  { q1: q1.mods, q2: q2.mods, q3: q3.mods, q4: q4.mods.length, q5: q5.mods, ai: usoAI });
// 15-18: la comunidad (discord_comunidad.js)
{   // (en un bloque: los nombres cortos no chocan con los de arriba)
const C = await import('../tienda/discord_comunidad.js');
const MOD = await import('../tienda/discord_moderacion.js'); const warnsDe = (u) => MOD.warnsDe(env, G, u);
const A = idDe(100), NUEVO = idDe(600);
await M.probarCodigo(env, A, G, 'Prueba(@1');
const cmdG = (name, quien = A, options, resolved) => ({ type: 2, guild_id: G, channel_id: '9100', token: 'tkg', member: { user: { id: quien, username: 'u' + quien.slice(-3) }, roles: [], joined_at: '2026-11-01T00:00:00Z', permissions: '8' }, data: { name, options, resolved } });
const subG = (name, options) => [{ type: 1, name, options }];
const posts = (desde, canal) => llamadas.slice(desde).filter((x) => x.m === 'POST' && x.ruta === `/channels/${canal}/messages`);
// 15: rol automático (con el aviso de jerarquía) y bienvenida (comandos, prueba y lo que llega por la puerta)
const ar1 = await pedir(cmdG('autorol', A, subG('agregar', [{ name: 'rol', value: idDe(200) }])));
const ar2 = await pedir(cmdG('autorol', A, subG('agregar', [{ name: 'rol', value: idDe(500) }])));
const ar3 = await pedir(cmdG('autorol', A, subG('ver')));
const bNo = await pedir(cmdG('bienvenida', idDe(101), subG('configurar', [{ name: 'canal', value: '9003' }])));
const bSi = await pedir(cmdG('bienvenida', A, subG('configurar', [{ name: 'canal', value: '9003' }, { name: 'despedida', value: true }])));
k = llamadas.length; const bPr = await pedir(cmdG('bienvenida', A, subG('probar'))); const prueba = posts(k, '9003')[0];
const socks2 = []; const pu2 = new P.PuertaJX(est, { ...envPuerta, __abrirWs: async () => { const w = new WsFalso(); socks2.push(w); return w; } });
await pu2.fetch(new Request('https://puerta/asegurar')); const w2 = socks2[0];
w2.recibir({ op: 10, d: { heartbeat_interval: 40000 } }); w2.recibir({ op: 0, t: 'READY', s: 1, d: { user: { id: 'app1' }, session_id: 's2' } });
w2.recibir({ op: 0, t: 'GUILD_CREATE', s: 2, d: { id: G, name: 'JXMod', member_count: 349, rules_channel_id: '9001', channels: [{ id: '9001', type: 0, name: 'reglas' }, { id: '9002', type: 0, name: 'actualizaciones-y-descarga' }, { id: '9003', type: 0, name: 'bievenida' }] } });
k = llamadas.length; w2.recibir({ op: 0, t: 'GUILD_MEMBER_ADD', s: 3, d: { guild_id: G, user: { id: NUEVO, username: 'nuevo', global_name: 'Nuevito' }, roles: [] } }); await espera(120);
const ent = llamadas.slice(k), bienv = posts(k, '9003'), puts = ent.filter((x) => x.m === 'PUT').map((x) => x.ruta.split('/').pop());
const rg = await pedir(cmdG('registro', A, [{ name: 'canal', value: '9004' }]));
k = llamadas.length; w2.recibir({ op: 0, t: 'GUILD_MEMBER_ADD', s: 4, d: { guild_id: G, user: { id: idDe(601), username: 'otrobot', bot: true }, roles: [] } }); await espera(80);
const conBot = llamadas.slice(k);
k = llamadas.length; w2.recibir({ op: 0, t: 'GUILD_MEMBER_REMOVE', s: 5, d: { guild_id: G, user: { id: NUEVO, username: 'nuevo', global_name: 'Nuevito' } } }); await espera(80);
const desp = posts(k, '9003'), regSal = posts(k, '9004');
const est2b = await (await pu2.fetch(new Request('https://puerta/estado'))).json();
ok('15. autorol (avisa la jerarquía: JXBot abajo de Miembro) y bienvenida: sólo admins; prueba; al entrar: roles, tarjeta con número, canales, banner y botones, festejo de los 350; al bot nada (sí al registro); despedida con la cuenta y registro',
  /Ojo/.test(ar1.d.data.content) && /arrastrá \*\*JXBot\*\*/.test(ar1.d.data.content) && /Listo/.test(ar2.d.data.content) && !/Ojo/.test(ar2.d.data.content) && (ar3.d.data.content.match(/<@&/g) || []).length === 2
    && /para admins/.test(bNo.d.data.content) && /<#9003>/.test(bSi.d.data.content) && /despedida/.test(bSi.d.data.content)
    && /prueba/.test(bPr.d.data.content) && prueba && /^\(prueba\)/.test(prueba.b.content) && prueba.b.allowed_mentions.users.length === 0 && prueba.b.embeds[0].image.url === C.BANNER
    && puts.join() === [idDe(200), idDe(500)].join() && bienv.length === 2 && bienv[0].b.content === `<@${NUEVO}>` && bienv[0].b.allowed_mentions.users[0] === NUEVO
    && /persona número \*\*350\*\*/.test(bienv[0].b.embeds[0].description) && /<#9002>/.test(bienv[0].b.embeds[0].description) && /<#9001>/.test(bienv[0].b.embeds[0].description) && /Nuevito/.test(bienv[0].b.embeds[0].title)
    && bienv[0].b.components[0].components.some((x) => x.url === 'https://x/JXMod.apk') && /Somos 350/.test(bienv[1].b.embeds[0].title)
    && /<#9004>/.test(rg.d.data.content) && !conBot.some((x) => x.m === 'PUT' || x.ruta === '/channels/9003/messages') && conBot.some((x) => x.ruta === '/channels/9004/messages')
    && desp.length === 1 && /se fue del servidor\. Ahora somos 350/.test(desp[0].b.embeds[0].description) && regSal.length === 1 && est2b.miembros === true && est2b.servidores === 1 && est2b.entradas === 2 && est2b.salidas === 1,
  { ar1: ar1.d.data.content.slice(0, 90), puts: puts.length, bienv: bienv.length, desc: bienv[0] && bienv[0].b.embeds[0].description.slice(0, 120), desp: desp.length, est: [est2b.servidores, est2b.entradas, est2b.salidas] });
// 16: niveles: XP una vez por minuto, al subir avisa y da el rol de premio, /nivel y /top, /niveles crear
const U1 = idDe(800), U2 = idDe(801);
const mGen = (id, u, extra = {}) => ({ op: 0, t: 'MESSAGE_CREATE', s: 10, d: { id, guild_id: G, channel_id: '9200', type: 0, author: { id: u, username: 'u' + u.slice(-3) }, member: { roles: [] }, content: 'charlando', mentions: [], ...extra } });
w2.recibir(mGen(idAhora(), U1)); await espera(60); w2.recibir(mGen(idAhora(), U1)); await espera(60);
const xp1 = await env.DB.prepare('SELECT xp, nivel, msgs FROM dc_xp WHERE guild = ?1 AND usuario = ?2').bind(G, U1).first();
const rr = await pedir(cmdG('niveles', A, subG('recompensa', [{ name: 'nivel', value: 1 }, { name: 'rol', value: idDe(500) }])));
await env.DB.prepare('INSERT INTO dc_xp (guild, usuario, xp, nivel, msgs, t) VALUES (?1, ?2, 95, 0, 7, 0)').bind(G, U2).run();
k = llamadas.length; w2.recibir(mGen(idAhora(), U2)); await espera(80);
const sube = posts(k, '9200'), premio = llamadas.slice(k).filter((x) => x.m === 'PUT' && x.ruta.endsWith(`/members/${U2}/roles/${idDe(500)}`));
const av = await pedir(cmdG('niveles', A, subG('avisos', [{ name: 'canal', value: '9300' }])));
await env.DB.prepare('UPDATE dc_xp SET xp = 250, nivel = 1, t = 0 WHERE guild = ?1 AND usuario = ?2').bind(G, U2).run(); C.olvidarAjustes(G);
const U3 = idDe(802); await env.DB.prepare('INSERT INTO dc_xp (guild, usuario, xp, nivel, msgs, t) VALUES (?1, ?2, 250, 1, 30, 0)').bind(G, U3).run();
k = llamadas.length; w2.recibir(mGen(idAhora(), U3)); await espera(80); const enCanal = posts(k, '9300');
const nv = await pedir(cmdG('nivel', U3)), tp = await pedir(cmdG('top', U1)), nvNo = await pedir(cmdG('nivel', idDe(999)));
const cr = await pedir(cmdG('niveles', A, subG('crear'))); await Promise.all(pendientes.splice(0));
const creados = (await env.DB.prepare('SELECT COUNT(*) AS n FROM dc_nivel_roles WHERE guild = ?1 AND nivel IN (5, 10, 20, 35, 50)').bind(G).first()).n;
const finCr = llamadas.filter((x) => x.m === "PATCH" && x.ruta === "/webhooks/app1/tkg/messages/@original").pop();
ok('16. niveles: XP una vez por minuto; al subir avisa y da el rol de premio; aviso en el canal elegido; /nivel con barra y puesto, /top, sin XP; /niveles crear arma 5 roles de premio; la cuenta de MEE6',
  xp1 && xp1.msgs === 1 && xp1.xp >= 15 && xp1.xp <= 25 && /nivel 1/.test(rr.d.data.content) && sube.length === 1 && /Subiste a nivel 1/.test(sube[0].b.embeds[0].description) && /Ganaste <@&/.test(sube[0].b.embeds[0].description) && premio.length === 1
    && /<#9300>/.test(av.d.data.content) && enCanal.length === 1 && /nivel 2/.test(enCanal[0].b.embeds[0].description)
    && nv.d.data.embeds[0].title === 'Nivel 2' && /█/.test(nv.d.data.embeds[0].description) && /Puesto \*\*#1\*\*/.test(nv.d.data.embeds[0].description)
    && /\*\*1\.\*\* <@/.test(tp.d.data.embeds[0].description) && /Todavía no tiene XP|Todavía no tenés XP/.test(nvNo.d.data.content)
    && cr.d.type === 5 && creados === 5 && finCr && /Listo, roles de premio/.test(finCr.b.content)
    && C.nivelDe(0).nivel === 0 && C.nivelDe(99).nivel === 0 && C.nivelDe(100).nivel === 1 && C.nivelDe(255).nivel === 2 && C.necesita(10) === 1100,
  { xp1, sube: sube.length, premio: premio.length, enCanal: enCanal.length, nivel: nv.d.data.embeds && nv.d.data.embeds[0].title, creados });
// 17: los warns: /warn borra sus mensajes de los últimos 15, le escribe, avisa en el canal; a los 3 alerta a los admins
// (registro con el rol de mods y privados) con botones; /warns propios y ajenos; /perdonar; la IA sabe los de quien pregunta
const X = idDe(900), resX = { users: { [X]: { id: X, username: 'troll', avatar: null } } }, MODS = idDe(990);
await pedir(cmdG('registro', A, [{ name: 'canal', value: '9004' }, { name: 'rol', value: MODS }]));
k = llamadas.length; const w1 = await pedir(cmdG('warn', A, [{ name: 'usuario', value: X }, { name: 'motivo', value: 'spam' }], resX)); await Promise.all(pendientes.splice(0));
const tras1 = llamadas.slice(k), bd1 = tras1.find((x) => /bulk-delete$/.test(x.ruta)), aviso1 = tras1.filter((x) => x.m === 'PATCH' && x.ruta === '/webhooks/app1/tkg/messages/@original').pop();
const priv1 = tras1.filter((x) => x.ruta === `/channels/dm-${X}/messages`);
await pedir(cmdG('warn', A, [{ name: 'usuario', value: X }, { name: 'motivo', value: 'insultos' }], resX)); await Promise.all(pendientes.splice(0));
k = llamadas.length; await pedir(cmdG('warn', A, [{ name: 'usuario', value: X }, { name: 'motivo', value: 'otra vez' }], resX)); await Promise.all(pendientes.splice(0));
const tras3 = llamadas.slice(k), aviso3 = tras3.filter((x) => x.m === 'PATCH' && x.ruta === '/webhooks/app1/tkg/messages/@original').pop();
const alertaReg = tras3.find((x) => x.ruta === '/channels/9004/messages' && x.b.components), alertaPriv = tras3.filter((x) => x.ruta === `/channels/dm-${A}/messages` && x.b.components);
const sinTimeout = !tras3.some((x) => x.m === 'PATCH' && x.ruta === `/guilds/${G}/members/${X}`);
const wSelf = await pedir(cmdG('warns', X)), wOtroNo = await pedir(cmdG('warns', U1, [{ name: 'usuario', value: X }])), wOtroSi = await pedir(cmdG('warns', A, [{ name: 'usuario', value: X }])), wCero = await pedir(cmdG('warns', U1));
const wBot = await pedir(cmdG('warn', A, [{ name: 'usuario', value: idDe(601) }, { name: 'motivo', value: 'x' }], { users: { [idDe(601)]: { id: idDe(601), bot: true } } }));
// la IA: los warns de quien escribe (y en la de otro, los suyos: 0)
await P.manejarMensaje(envDO, { id: 'w1', guild_id: G, channel_id: '9200', author: { id: X, username: 'troll' }, content: '/jb tengo warns?', mentions: [] }, YO);
const sisX = geminiPedidos[geminiPedidos.length - 1].systemInstruction.parts[0].text;
await P.manejarMensaje(envDO, { id: 'w2', guild_id: G, channel_id: '9200', author: { id: idDe(803), username: 'limpio' }, content: '/jb y los warns de troll?', mentions: [] }, YO);
const sisL = geminiPedidos[geminiPedidos.length - 1].systemInstruction.parts[0].text;
// los botones de la alerta: un no admin no puede; el admin perdona por privado y el mensaje queda resuelto
const boton = (quien, custom_id, enServidor) => pedir({ type: 3, token: 'tb', ...(enServidor ? { guild_id: G, channel_id: '9004', member: { user: { id: quien, username: 'b' } } } : { channel_id: 'dm', user: { id: quien, username: 'b' } }), data: { custom_id }, message: { embeds: alertaReg.b.embeds } });
const btnNo = await boton(U1, alertaReg.b.components[0].components[3].custom_id, true);
const bPerd = await boton(A, alertaReg.b.components[0].components[3].custom_id, false);
const tras = (await warnsDe(X)).n;
ok('17. warns: /warn borra sus 2 mensajes de los últimos 15, le escribe y avisa en el canal (1/3); al 3/3 alerta en el registro (con el rol de mods) y por privado a los admins con botones, sin silenciarlo solo; /warns propios sí, ajenos sólo admins; a un bot no; la IA sabe los warns de quien pregunta y no los de otro; el botón: un no admin no, el admin perdona (0/3) y la alerta queda resuelta',
  w1.d.type === 5 && bd1 && bd1.b.messages.length === 2 && aviso1 && /warn \(1\/3\)\*\*: spam/.test(aviso1.b.embeds[0].description) && /Borré 2 mensajes suyos/.test(aviso1.b.embeds[0].footer.text) && aviso1.b.allowed_mentions.users[0] === X && priv1.length === 1 && /1\/3/.test(priv1[0].b.embeds[0].title)
    && aviso3 && /warn \(3\/3\)/.test(aviso3.b.embeds[0].description) && /ya les avisé a los admins/.test(aviso3.b.embeds[0].footer.text) && alertaReg && alertaReg.b.content === `<@&${MODS}>` && alertaReg.b.components[0].components.map((x) => x.label).join() === 'Banear,Expulsar,Silenciar 1 día,Perdonar (0/3)'
    && alertaPriv.length === 1 && sinTimeout
    && /\*\*3\/3\*\*/.test(wSelf.d.data.content) && /Tenés/.test(wSelf.d.data.content) && wSelf.d.data.flags === 64 && /Sólo podés ver tus warns/.test(wOtroNo.d.data.content) && /tiene \*\*3\/3\*\*/.test(wOtroSi.d.data.content) && /No tenés warns: 0\/3/.test(wCero.d.data.content) && /bot no/.test(wBot.d.data.content)
    && /troll tiene 3 de 3 warns.*«otra vez».*en este servidor/.test(sisX) && /Nunca digas los warns de otra persona/.test(sisX) && /limpio tiene 0 de 3 warns/.test(sisL) && !/troll tiene/.test(sisL)
    && /Sólo los admins del bot/.test(btnNo.d.data.content) && bPerd.d.type === 7 && bPerd.d.data.components.length === 0 && /perdonado \(0\/3\)/.test(bPerd.d.data.embeds[0].fields.pop().value) && tras === 0,
  { borrados: bd1 && bd1.b.messages.length, aviso3: aviso3 && aviso3.b.embeds[0].footer.text, alerta: alertaReg && alertaReg.b.content, priv: alertaPriv.length, ia: (sisX.match(/troll tiene[^.]*/) || [])[0], boton: bPerd.d.type });
// 19: más moderación: /perdonar, /historial, /silenciar, /limpiar, /ban, /expulsar, /desbanear, /lento, /bloquear y
// desbloquear, y con clic derecho «Reportar a los mods» (tope de 5 por hora) y «Warn por este mensaje» (pide el motivo)
await pedir(cmdG('warn', A, [{ name: 'usuario', value: X }, { name: 'motivo', value: 'de nuevo' }], resX)); await Promise.all(pendientes.splice(0));
const pd = await pedir(cmdG('perdonar', A, [{ name: 'usuario', value: X }])), pdOtra = await pedir(cmdG('perdonar', A, [{ name: 'usuario', value: X }]));
const hi = await pedir(cmdG('historial', A, [{ name: 'usuario', value: X }]));
k = llamadas.length; const s1 = await pedir(cmdG('silenciar', A, [{ name: 'usuario', value: X }, { name: 'minutos', value: 10 }]));
const s0 = await pedir(cmdG('silenciar', A, [{ name: 'usuario', value: X }, { name: 'minutos', value: 0 }])); const ps = llamadas.slice(k).filter((x) => x.m === 'PATCH');
const hasta = ps[0] && Date.parse(ps[0].b.communication_disabled_until) - Date.now();
k = llamadas.length; const l1 = await pedir(cmdG('limpiar', A, [{ name: 'cantidad', value: 3 }])); const bdl = llamadas.slice(k).find((x) => /bulk-delete$/.test(x.ruta));
k = llamadas.length; const l2 = await pedir(cmdG('limpiar', A, [{ name: 'cantidad', value: 10 }, { name: 'usuario', value: idDe(701) }])); const bdl2 = llamadas.slice(k).find((x) => /bulk-delete$/.test(x.ruta));
sinPermisoBorrar = true; const l3 = await pedir(cmdG('limpiar', A, [{ name: 'cantidad', value: 2 }])); sinPermisoBorrar = false;
const Y = idDe(910), resY = { users: { [Y]: { id: Y, username: 'malo' } } };
k = llamadas.length; const bn = await pedir(cmdG('ban', A, [{ name: 'usuario', value: Y }, { name: 'motivo', value: 'raid' }, { name: 'borrar', value: 86400 }], resY)); await Promise.all(pendientes.splice(0));
const ban = llamadas.slice(k).find((x) => x.m === 'PUT' && x.ruta === `/guilds/${G}/bans/${Y}`), privBan = llamadas.slice(k).findIndex((x) => x.ruta === `/channels/dm-${Y}/messages`), idxBan = llamadas.slice(k).indexOf(ban);
k = llamadas.length; await pedir(cmdG('expulsar', A, [{ name: 'usuario', value: idDe(911) }, { name: 'motivo', value: 'x' }], { users: { [idDe(911)]: { id: idDe(911) } } })); await Promise.all(pendientes.splice(0));
const kick = llamadas.slice(k).find((x) => x.m === 'DELETE' && x.ruta === `/guilds/${G}/members/${idDe(911)}`);
const db = await pedir(cmdG('desbanear', A, [{ name: 'usuario', value: `<@${Y}>` }])), db404 = await pedir(cmdG('desbanear', A, [{ name: 'usuario', value: idDe(951) }])), dbMal = await pedir(cmdG('desbanear', A, [{ name: 'usuario', value: 'fulano' }]));
k = llamadas.length; const le = await pedir(cmdG('lento', A, [{ name: 'segundos', value: 30 }])); const lento = llamadas.slice(k).find((x) => x.m === 'PATCH' && x.ruta === '/channels/9100');
k = llamadas.length; const bl = await pedir(cmdG('bloquear', A, [{ name: 'motivo', value: 'pelea' }])); const owB = llamadas.slice(k).find((x) => x.m === 'PUT' && x.ruta === `/channels/9100/permissions/${G}`);
k = llamadas.length; const dbl = await pedir(cmdG('desbloquear', A)); const owD = llamadas.slice(k).find((x) => x.m === 'PUT' && x.ruta === `/channels/9100/permissions/${G}`);
const S = 1n << 11n, SH = 1n << 38n;
// clic derecho: reportar (cualquiera) y warn por este mensaje (mods)
const MID = idAhora(Date.now() - 30e3), elMsg = { id: MID, channel_id: '9100', author: { id: X, username: 'troll' }, content: 'mensaje feo' };
const menu = (quien, name) => pedir({ type: 2, guild_id: G, channel_id: '9100', token: 'tkm', member: { user: { id: quien, username: 'm' }, roles: [] }, data: { type: 3, name, target_id: MID, resolved: { messages: { [MID]: elMsg } } } });
k = llamadas.length; const rp = await menu(U1, 'Reportar a los mods'); const repAl = llamadas.slice(k).find((x) => x.ruta === '/channels/9004/messages' && x.b.components);
for (let i = 0; i < 4; i++) await menu(U1, 'Reportar a los mods');
const rp6 = await menu(U1, 'Reportar a los mods'), rpYo = await pedir({ type: 2, guild_id: G, channel_id: '9100', token: 'tkm', member: { user: { id: X } }, data: { type: 3, name: 'Reportar a los mods', target_id: MID, resolved: { messages: { [MID]: elMsg } } } });
k = llamadas.length; const rbW = await pedir({ type: 3, token: 'tb', channel_id: 'dm', user: { id: A, username: 'a' }, data: { custom_id: repAl.b.components[0].components[0].custom_id }, message: { embeds: repAl.b.embeds } });
const delRep = llamadas.slice(k).find((x) => /bulk-delete$/.test(x.ruta));
const wmNo = await menu(U1, 'Warn por este mensaje'), wm = await menu(A, 'Warn por este mensaje');
k = llamadas.length;
const wmEnv = await pedir({ type: 5, guild_id: G, channel_id: '9100', token: 'tkm', member: { user: { id: A, username: 'a' } }, data: { custom_id: wm.d.data.custom_id, components: [{ type: 1, components: [{ type: 4, custom_id: 'motivo', value: 'insulto en el chat' }] }] } }); await Promise.all(pendientes.splice(0));
const wmFin = llamadas.slice(k).filter((x) => x.m === 'PATCH' && x.ruta === '/webhooks/app1/tkm/messages/@original').pop();
ok('19. /perdonar (0/3; otra vez: no tenía), /historial, /silenciar 10 min y 0, /limpiar (y sólo de alguien, y sin permiso), /ban (privado antes, borra un día), /expulsar, /desbanear (con @ o ID; no baneado; sin ID), /lento 30 s, /bloquear y /desbloquear (sólo enviar), reportar (al registro con botones; 5 por hora; a uno mismo no), «Warn y borrar» desde el reporte, «Warn por este mensaje» (sólo admins, pide el motivo)',
  /tenía 1/.test(pd.d.data.content) && /no tenía warns/.test(pdOtra.d.data.content) && /warns ahora: \*\*0\/3\*\*/.test(hi.d.data.content) && /\*\*perdon\*\*/.test(hi.d.data.content) && /\*\*warn\*\*: de nuevo/.test(hi.d.data.content)
    && ps.length === 2 && hasta > 595e3 && hasta < 605e3 && ps[1].b.communication_disabled_until === null && /hasta/.test(s1.d.data.content) && /ya puede escribir/.test(s0.d.data.content)
    && /borré 3/.test(l1.d.data.content) && bdl && bdl.b.messages.length === 3 && bdl2 && bdl2.b.messages.length === 2 && /Gestionar mensajes/.test(l3.d.data.content)
    && bn.d.type === 5 && ban && ban.b.delete_message_seconds === 86400 && privBan >= 0 && privBan < idxBan && kick
    && /ya puede volver/.test(db.d.data.content) && /no está baneada/.test(db404.d.data.content) && /ID de la persona/.test(dbMal.d.data.content)
    && lento && lento.b.rate_limit_per_user === 30 && /cada 30 s/.test(le.d.data.content)
    && owB && (BigInt(owB.b.deny) & S) && (BigInt(owB.b.deny) & SH) && (BigInt(owB.b.deny) & 64n) && !(BigInt(owB.b.allow) & S) && /Canal bloqueado/.test(bl.d.data.embeds[0].description)
    && owD && !(BigInt(owD.b.deny) & S) && /desbloqueado/.test(dbl.d.data.embeds[0].description)
    && /se lo pasé a los mods/.test(rp.d.data.content) && repAl && /mensaje feo/.test(repAl.b.embeds[0].description) && repAl.b.components[0].components.length === 3 && /5 reportes/.test(rp6.d.data.content) && /a vos/.test(rpYo.d.data.content)
    && rbW.d.type === 7 && /warn 1\/3/.test(rbW.d.data.embeds[0].fields.pop().value) && delRep && delRep.b.messages.includes(MID)
    && /para admins/.test(wmNo.d.data.content) && wm.d.type === 9 && wm.d.data.custom_id === `wm:9100:${MID}:${X}` && wmEnv.d.type === 5 && wmFin && /warn \(2\/3\)\*\*: insulto en el chat/.test(wmFin.b.embeds[0].description),
  { pd: pd.d.data.content, ban: !!ban, privAntes: privBan < idxBan, ow: owB && [owB.b.allow, owB.b.deny], rep: rp.d.data.content, rbW: rbW.d.data && rbW.d.data.embeds && rbW.d.data.embeds[0].fields.slice(-1)[0], wm: wmFin && wmFin.b.embeds[0].description });
// 18: utilidades y cómo se registran: /servidor, /usuario, /encuesta, /ayuda; los de admin escondidos para quien no tiene permiso
const sv = await pedir(cmdG('servidor', U1)), us = await pedir(cmdG('usuario', U1, [{ name: 'usuario', value: U3 }], { users: { [U3]: { id: U3, username: 'tres', global_name: 'Tres' } }, members: { [U3]: { joined_at: '2026-10-01T00:00:00Z', roles: [idDe(500)] } } }));
const en = await pedir(cmdG('encuesta', A, [{ name: 'pregunta', value: '¿Qué mapa sigue?' }, { name: 'opciones', value: 'Desert, City | Mars' }]));
const en1 = await pedir(cmdG('encuesta', A, [{ name: 'pregunta', value: '¿?' }, { name: 'opciones', value: 'sola' }]));
const ay = await pedir({ type: 2, channel_id: 'dmx', token: 't', user: { id: U1, username: 'x' }, data: { name: 'ayuda' } });
const nombres = M.COMANDOS.map((c) => c.name), adminSinPermiso = M.COMANDOS.filter((c) => ['bienvenida', 'autorol', 'niveles', 'registro', 'encuesta', 'limpiar', 'warn', 'perdonar', 'historial', 'silenciar', 'expulsar', 'ban', 'desbanear', 'lento', 'bloquear', 'desbloquear', 'Warn por este mensaje', 'reiniciar-limite', 'configurar', 'roles', 'anunciar'].includes(c.name) && !c.default_member_permissions);
const bienPuestos = (L) => L.every((o) => (o.type === 3 && !o.description && !o.options ? o.name.length <= 32 : o.name && o.description && o.description.length <= 100 && /^[a-z0-9_-]{1,32}$/.test(o.name) && (!o.options || bienPuestos(o.options))));
ok('18. /servidor, /usuario (cuenta, entrada, nivel, roles), /encuesta de Discord (y con 1 opción no), /ayuda también por privado; 37 comandos (2 de clic derecho) sin repetir, bien formados, los de admin escondidos',
  sv.d.data.embeds[0].title === 'JXMod' && sv.d.data.embeds[0].fields.find((f) => f.name === 'Miembros').value === '349' && us.d.data.embeds[0].author.name === 'Tres' && us.d.data.embeds[0].fields.some((f) => f.name === 'Entró al servidor') && us.d.data.embeds[0].fields.find((f) => f.name === 'Nivel').value.startsWith('2')
    && en.d.data.poll && en.d.data.poll.answers.length === 3 && en.d.data.poll.duration === 24 && en.d.data.poll.answers[2].poll_media.text === 'Mars' && /al menos 2/.test(en1.d.data.content)
    && ay.d.data.flags === 64 && ay.d.data.embeds[0].fields.length === 4 && nombres.length === 37 && new Set(nombres).size === 37 && adminSinPermiso.length === 0 && bienPuestos(M.COMANDOS),
  { nombres: nombres.length, sinPermiso: adminSinPermiso.map((c) => c.name), poll: en.d.data.poll && en.d.data.poll.answers.map((x) => x.poll_media.text) });
// 20: el límite para hablarle (7 s entre mensajes, 10 cada 30 min, con el contador de Discord; admins y mods sin
// límite; el aviso una sola vez por espera; /limite y /reiniciar-limite; /jb avisa sólo a quien tiene que esperar)
{
  const IA = await import('../tienda/discord_ia.js'), { IA_ESPERA_MS: _e, ...envL } = env;
  const T = Date.parse('2026-11-22T12:00:00Z'), pregunta = (usuario, ahora, extra = {}) => IA.respuestaIA(envL, { canal: 'cl', usuario, nombre: 'L', texto: 'hola', ahora, ...extra });
  const r1 = await pregunta('L1', T), r2 = await pregunta('L1', T + 3000), r3 = await pregunta('L1', T + 7001);
  const seguidas = []; for (let i = 1; i <= 8; i++) seguidas.push(await pregunta('L1', T + 7001 + i * 8000));
  const r11 = await pregunta('L1', T + 7001 + 9 * 8000), r12 = await pregunta('L1', T + 30 * 60e3 + 1);
  const adm = []; for (let i = 0; i < 12; i++) adm.push(await pregunta('L2', T, { admin: true }));
  const mods = []; for (let i = 0; i < 3; i++) mods.push(await pregunta('L3', T, { mod: true }));
  // por la puerta: un rol con «Aislar temporalmente» es mod; uno normal recibe el aviso una vez y después nada
  const MODR = idDe(980), NOR = idDe(850), MODU = idDe(851);
  w2.recibir({ op: 0, t: 'GUILD_ROLE_CREATE', s: 30, d: { guild_id: G, role: { id: MODR, name: 'Mod', permissions: String(1n << 40n) } } }); await espera(10);
  const mg = (id, u, roles) => ({ op: 0, t: 'MESSAGE_CREATE', s: 31, d: { id, guild_id: G, channel_id: '9500', type: 0, author: { id: u, username: 'x' }, member: { roles }, content: '/jb hola', mentions: [] } });
  k = llamadas.length;
  for (let i = 0; i < 3; i++) { w2.recibir(mg('n' + i, NOR, [])); await espera(60); }
  for (let i = 0; i < 3; i++) { w2.recibir(mg('m' + i, MODU, [MODR])); await espera(60); }
  const enCanal = posts(k, '9500'), aNor = enCanal.filter((x) => x.b.message_reference && x.b.message_reference.message_id.startsWith('n')), aMod = enCanal.filter((x) => x.b.message_reference && x.b.message_reference.message_id.startsWith('m'));
  // /limite y /reiniciar-limite, y /jb que avisa sólo a quien espera
  await espera(3100);   // (que pase la espera entre mensajes: /limite muestra lo que queda)
  const comun = (c) => ({ ...c, member: { ...c.member, permissions: '0' } });   // (sin permisos de Discord: un usuario común)
  const lim = await pedir(comun(cmdG('limite', NOR))), limAdm = await pedir(cmdG('limite', A)), limOtroNo = await pedir(comun(cmdG('limite', U1, [{ name: 'usuario', value: NOR }])));
  const rein = await pedir(cmdG('reiniciar-limite', A, [{ name: 'usuario', value: NOR }])), lim2 = await pedir(comun(cmdG('limite', NOR))), reinNo = await pedir(comun(cmdG('reiniciar-limite', U1, [{ name: 'usuario', value: NOR }])));
  const JBU = idDe(852), jbG = (q) => pedir({ ...cmdG('jb', JBU, [{ name: 'mensaje', value: q }]), member: { user: { id: JBU, username: 'jb' }, roles: [], permissions: '0' } });
  const jb1 = await jbG('hola'); await Promise.all(pendientes.splice(0)); const jb2 = await jbG('otra');
  const jbMod = await pedir({ ...cmdG('jb', idDe(853), [{ name: 'mensaje', value: 'x' }]), member: { user: { id: idDe(853), username: 'mod' }, roles: [], permissions: String(1n << 40n) } }); await Promise.all(pendientes.splice(0));
  const jbMod2 = await pedir({ ...cmdG('jb', idDe(853), [{ name: 'mensaje', value: 'y' }]), member: { user: { id: idDe(853), username: 'mod' }, roles: [], permissions: String(1n << 40n) } }); await Promise.all(pendientes.splice(0));
  const cuenta = (x) => (x.match(/<t:(\d+):R>/) || [])[1];
  ok('20. límite: 7 s entre mensajes (con el contador <t:…:R>), 10 cada 30 min que se renuevan solos; admins y mods sin límite; por la puerta el rol con permisos de mod no tiene límite y al normal se le avisa una sola vez; /limite, /reiniciar-limite (sólo admins y mods); /jb avisa en privado a quien espera, al mod no',
    r1.texto && r2.espera && r2.tipo === 'espera' && cuenta(r2.espera) === String(Math.ceil((T + 7000) / 1000)) && r3.texto && seguidas.every((x) => x.texto)
      && r11.espera && r11.tipo === 'ventana' && /10 mensajes en 30 minutos/.test(r11.espera) && cuenta(r11.espera) === String(Math.ceil((T + 30 * 60e3) / 1000)) && r12.texto
      && adm.every((x) => x.texto) && mods.every((x) => x.texto)
      && aNor.length === 2 && /Respuesta IA/.test(aNor[0].b.content) && /Pará un toque: podés volver a hablarme <t:\d+:R>/.test(aNor[1].b.content) && aMod.length === 3 && aMod.every((x) => /Respuesta IA/.test(x.b.content))
      && /Te quedan \*\*9 de 10\*\*/.test(lim.d.data.content) && /sin límite|no hay límite/.test(limAdm.d.data.content) && /Sólo podés ver el tuyo/.test(limOtroNo.d.data.content)
      && /vuelve a tener 10 de 10/.test(rein.d.data.content) && /\*\*10 de 10\*\*/.test(lim2.d.data.content) && /admins y mods/.test(reinNo.d.data.content)
      && jb1.d.type === 5 && jb2.d.type === 4 && jb2.d.data.flags === 64 && /Pará un toque/.test(jb2.d.data.content) && jbMod.d.type === 5 && jbMod2.d.type === 5,
    { r2: r2.espera, r11: r11.espera, nor: aNor.map((x) => x.b.content.slice(0, 40)), mod: aMod.length, lim: lim.d.data.content, jb2: jb2.d.data && jb2.d.data.content });
}
pu2.cerrar();
}
pu.cerrar();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length); process.exit(R.every(Boolean) ? 0 : 1);
