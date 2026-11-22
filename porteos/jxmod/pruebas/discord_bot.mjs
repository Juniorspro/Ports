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
// uso: node discord_bot.mjs
import { d1 } from '../../stickerazo/pruebas/d1_falsa.mjs';
const M = await import('../tienda/discord.js');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const enc = new TextEncoder(), hex = (u) => [...new Uint8Array(u)].map((b) => b.toString(16).padStart(2, '0')).join('');
const par = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const pub = hex(await crypto.subtle.exportKey('raw', par.publicKey));
// la API de Discord de mentira y los archivos de versión
const llamadas = []; let roles = [{ id: 'r0', name: '@everyone' }], reglas = [], sigRol = 1, sigRegla = 1;
let VERSION = { codigo: 3911, version: '3.9.11', apk: 'https://x/JXMod.apk', web: 'https://x/web/', notas_es: 'Arreglos del 21/11' }, APP = { v: 26112190, nombre: '0.8' };
async function falso(url, op = {}) {
  const u = String(url), m = op.method || 'GET', b = op.body ? JSON.parse(op.body) : undefined;
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
const env = { DB: d1(), DISCORD_APP_ID: 'app1', DISCORD_PUBLIC_KEY: pub, DISCORD_TOKEN: 'tok', DISCORD_ADMIN_CODE: 'Prueba(@1', __fetch: falso };
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
env.DISCORD_ADMIN_CODE = 'OtroCodigo!'; const tras = await pedir(cmd('anunciar', ADMIN, [{ name: 'titulo', value: 'x' }, { name: 'texto', value: 'y' }]));
ok('8. si el código cambia, el que se habilitó con el anterior deja de ser admin', /primero mandame el código/.test(tras.d.data.content), tras.d.data.content);
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length); process.exit(R.every(Boolean) ? 0 : 1);
