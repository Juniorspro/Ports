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
// 14. la cadena de modelos de Gemini: sin cupo, respuesta cortada, pregunta cortada.
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
  if (/\/roles$/.test(ruta) && m === 'GET') return new Response(JSON.stringify(roles));
  if (/\/roles$/.test(ruta) && m === 'POST') { const r = { id: 'r' + sigRol++, ...b }; roles.push(r); return new Response(JSON.stringify(r)); }
  if (/auto-moderation\/rules$/.test(ruta) && m === 'GET') return new Response(JSON.stringify(reglas));
  if (/auto-moderation\/rules$/.test(ruta) && m === 'POST') { const r = { id: 'a' + sigRegla++, ...b }; reglas.push(r); return new Response(JSON.stringify(r)); }
  return new Response(JSON.stringify({ id: 'm1' }));
}
// (como en Cloudflare: fetch llamado como método de otro objeto —env.__fetch(…)— da «Illegal invocation»)
function estricto(...a) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation: fetch llamado como método'); return falso(...a); }
const env = { DB: d1(), DISCORD_APP_ID: 'app1', DISCORD_PUBLIC_KEY: pub, DISCORD_TOKEN: 'tok', DISCORD_ADMIN_CODE: 'Prueba(@1', GEMINI_KEY: 'gk', __fetch: estricto };
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
pu.ack = false; pu.latir(); await espera(20);
ok('10. puerta: se identifica (privados + servidores + texto) con «Escribí /JB»; READY; el mensaje /jb se contesta; con 4014 se reconecta sin texto; sin ack, reconecta',
  e0 && alarma && ident && ident.d.intents === ((1 << 9) | (1 << 12) | (1 << 15)) && ident.d.token === 'tok' && /\/JB/.test(ident.d.presence.activities[0].state) && e1.conectado && viaPuerta.length === 1 && /hola bot/.test(viaPuerta[0].b.content)
    && ident2 && ident2.d.intents === ((1 << 9) | (1 << 12)) && socks.length === 3,
  { intents: [ident && ident.d.intents, ident2 && ident2.d.intents], conectado: e1.conectado, sockets: socks.length });
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
pu.cerrar();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length); process.exit(R.every(Boolean) ? 0 : 1);
