// Entrar con Google (servidor/google.js), punta a punta con el Worker de verdad: tokens firmados con una llave de prueba
// (el servidor la usa en vez de las de Google: SZ_JWKS_PRUEBA), el nonce, la entrada que espera a la app, el ticket para
// el @, vincular una cuenta vieja, que sin Google no se escriba nada, borrar desde la web y el formulario de contacto.
// uso: node google.mjs
import crypto from 'crypto'; import { arrancar } from './servidor_local.mjs';
const PUERTO = 8994, B = `http://127.0.0.1:${PUERTO}${process.env.SZ_BASE || ''}`, CLIENTE = 'prueba-stickerazo.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const { privateKey: otra } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { srv, env: ENV } = await arrancar(PUERTO, 'clave-admin', { SZ_GOOGLE_CLIENT_ID: CLIENTE, SZ_JWKS_PRUEBA: JSON.stringify({ keys: [jwk] }) });
const T = process.env.SZ_BASE ? 'sz_' : '';   // (adentro del Worker de JXMod las tablas son «sz_…»)
let fallas = 0, bien = 0; const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); c ? bien++ : fallas++; };
const b64u = (b) => Buffer.from(b).toString('base64url');
const ahora = () => Math.floor(Date.now() / 1000);
function token(datos, { llave = privateKey, kid = 'k1' } = {}) {
  const cab = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })), cu = b64u(JSON.stringify({ iss: 'https://accounts.google.com', aud: CLIENTE, iat: ahora(), exp: ahora() + 3600, ...datos }));
  return `${cab}.${cu}.${b64u(crypto.sign('RSA-SHA256', Buffer.from(cab + '.' + cu), llave))}`;
}
const api = async (ruta, o = {}, tok) => { const h = { ...(o.headers || {}) }; if (tok) h.Authorization = 'Bearer ' + tok; if (o.json) { h['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.json); } const r = await fetch(B + ruta, { ...o, headers: h }); let j = null; try { j = await r.json(); } catch (e) { /* nada */ } return { st: r.status, j }; };
const verificador = () => crypto.randomBytes(32).toString('hex'), eDe = (v) => crypto.createHash('sha256').update(v).digest('hex');
// lo que hace la app + la página: entrar con Google con la cuenta «sub»
async function entrar(sub, tok) {
  const v = verificador(), e = eDe(v);
  const p = await api('/api/google', { method: 'POST', json: { credencial: token({ sub, nonce: e }), e } });
  const l = await api('/api/google/listo', { method: 'POST', json: { v } }, tok);
  return { p, l };
}

const cfg = await api('/api/config');
ok(cfg.j.google === true && cfg.j.entrar.endsWith('/entrar'), `config: Google prendido y la página para entrar (${cfg.j.entrar.replace(B, '')})`);
ok((await api('/api/registro', { method: 'POST', json: { nombre: 'sin.google' } })).st === 401, 'con Google prendido no se puede hacer una cuenta sólo con el @');
// la página del navegador
const sinE = await fetch(B + '/entrar'), conE = await fetch(B + '/entrar?e=' + eDe(verificador())), pag = await conE.text();
ok(sinE.status === 400 && conE.status === 200 && pag.includes(CLIENTE) && pag.includes('accounts.google.com/gsi/client') && /frame-src https:\/\/accounts\.google\.com/.test(conE.headers.get('content-security-policy')) && conE.headers.get('x-frame-options') === 'DENY',
  'la página para entrar: sólo con e, con el botón de Google, y protegida (CSP, no se puede meter en un marco)');
// tokens que no tienen que pasar
{
  const v = verificador(), e = eDe(v), malos = {
    'firmado con otra llave': token({ sub: 'g1', nonce: e }, { llave: otra }), 'de otra app (audiencia)': token({ sub: 'g1', nonce: e, aud: 'otra.apps.googleusercontent.com' }),
    'de otro emisor': token({ sub: 'g1', nonce: e, iss: 'https://malo.com' }), 'vencido': token({ sub: 'g1', nonce: e, iat: ahora() - 7200, exp: ahora() - 3600 }),
    'con otro nonce': token({ sub: 'g1', nonce: eDe(verificador()) }), 'con otra clave (kid)': token({ sub: 'g1', nonce: e }, { kid: 'k9' }), 'roto': 'a.b.c' };
  const st = []; for (const [, t] of Object.entries(malos)) st.push((await api('/api/google', { method: 'POST', json: { credencial: t, e } })).st);
  ok(st.every((x) => x === 401), `tokens que no pasan: ${Object.keys(malos).join(', ')} (${st.join(' ')})`);
  ok((await api('/api/google/listo', { method: 'POST', json: { v } })).j.esperando === true, '…y la app sigue esperando (no se creó ninguna entrada)');
}
// una cuenta nueva con Google: la entrada, el ticket y el @
const v1 = verificador(), e1 = eDe(v1);
const p1 = await api('/api/google', { method: 'POST', json: { credencial: token({ sub: 'google-juan', nonce: e1, email: 'juan@gmail.com', name: 'Juan' }), e: e1 } });
ok(p1.j && p1.j.ok && p1.j.nombre === null, 'la página manda el token y queda la entrada (cuenta nueva: todavía sin @)');
ok((await api('/api/google/listo', { method: 'POST', json: { v: verificador() } })).j.esperando === true, 'otro verificador (alguien que vio la dirección) no se la lleva');
const l1 = await api('/api/google/listo', { method: 'POST', json: { v: v1 } });
ok(l1.j && l1.j.nuevo === true && l1.j.ticket, 'la app se lleva un ticket para elegir su @');
ok((await api('/api/google/listo', { method: 'POST', json: { v: v1 } })).j.esperando === true, 'una sola vez: el mismo verificador después ya no trae nada');
const reg = await api('/api/registro', { method: 'POST', json: { nombre: 'juan.google', ticket: l1.j.ticket } }), TJ = reg.j && reg.j.token;
ok(reg.st === 201 && reg.j.usuario.conGoogle === true, 'con el ticket se crea la cuenta @juan.google, atada a Google');
ok((await api('/api/registro', { method: 'POST', json: { nombre: 'juan.otra', ticket: l1.j.ticket } })).st === 401, 'el ticket no sirve dos veces');
const fila = (await ENV.DB.prepare(`SELECT * FROM ${T}usuarios WHERE nombre = 'juan.google'`).all()).results[0];
ok(fila.google && fila.google !== 'google-juan' && /^[a-f0-9]{64}$/.test(fila.google) && !JSON.stringify(fila).includes('juan@gmail.com') && !JSON.stringify(fila).includes('"Juan"'),
  'de Google se guarda sólo una huella del id: ni el id, ni el mail, ni el nombre');
// volver a entrar (otro celular): la misma cuenta, y la llave vieja deja de andar
const { l: l2 } = await entrar('google-juan');
ok(l2.j && l2.j.token && l2.j.usuario.nombre === 'juan.google', 'volver a entrar con la misma cuenta de Google: la misma cuenta, sin elegir @ otra vez');
ok((await api('/api/yo', {}, TJ)).st === 401 && (await api('/api/yo', {}, l2.j.token)).st === 200, 'la sesión nueva reemplaza a la vieja');
const TJ2 = l2.j.token;
ok((await api('/api/yo', { method: 'PATCH', json: { bio: 'hola' } }, TJ2)).st === 200, 'con Google se puede editar el perfil');
// una cuenta vieja (sólo @): no escribe nada hasta vincular Google; después sigue siendo la misma
{
  const llave = 'llave-vieja-de-prueba-123456', id = 'viejacta01';
  await ENV.DB.prepare(`INSERT INTO ${T}usuarios (id, nombre, clave, avatar, creado) VALUES (?, ?, ?, ?, ?)`).bind(id, 'la.vieja', crypto.createHash('sha256').update(llave).digest('hex'), '{}', Date.now()).run();
  const TV = `${id}.${llave}`, yo = await api('/api/yo', {}, TV), bloq = await api('/api/yo', { method: 'PATCH', json: { bio: 'x' } }, TV), seg = await api(`/api/usuarios/${fila.id}/seguir`, { method: 'POST' }, TV);
  ok(yo.st === 200 && yo.j.usuario.conGoogle === false && yo.j.google === true && bloq.st === 403 && bloq.j.google === true && seg.st === 403, 'una cuenta vieja (sólo @) puede mirar, pero para escribir le pide Google');
  const { l } = await entrar('google-vieja', TV), yo2 = await api('/api/yo', {}, l.j && l.j.token);
  ok(l.j && l.j.token && l.j.token.startsWith(id + '.') && yo2.j.usuario.nombre === 'la.vieja' && yo2.j.usuario.conGoogle === true, 'al entrar con Google desde la app, se le vincula: misma cuenta (@la.vieja), ahora con Google');
  ok((await api(`/api/usuarios/${fila.id}/seguir`, { method: 'POST' }, l.j.token)).st === 200, '…y ya puede seguir gente');
}
// borrar la cuenta desde la web, con Google
{
  const viejo = token({ sub: 'google-juan', iat: ahora() - 1200 });
  ok((await api('/api/google/borrar', { method: 'POST', json: { credencial: viejo } })).st === 401, 'borrar desde la web: un token de hace 20 minutos no sirve');
  ok((await api('/api/google/borrar', { method: 'POST', json: { credencial: token({ sub: 'google-nadie' }) } })).st === 404, 'una cuenta de Google sin cuenta de Stickerazo: lo dice');
  const b = await api('/api/google/borrar', { method: 'POST', json: { credencial: token({ sub: 'google-juan' }) } });
  ok(b.j && b.j.ok && b.j.nombre === 'juan.google' && (await api('/api/usuarios/juan.google')).st === 404 && (await api('/api/yo', {}, TJ2)).st === 401, 'borrar desde la web con Google: la cuenta y su sesión se van');
  const pb = await fetch(B + '/borrar'); ok(pb.status === 200 && (await pb.text()).includes('Borrar tu cuenta'), 'la página para borrar con Google');
}
// el formulario de contacto
{
  const c = (d) => api('/api/contacto', { method: 'POST', json: d, headers: { 'CF-Connecting-IP': '10.9.9.9' } });
  const corto = await c({ motivo: 'consulta', texto: 'hola' }), malMail = await c({ motivo: 'consulta', texto: 'quiero saber algo de la app', mail: 'no-es-un-mail' });
  const bueno = await c({ motivo: 'privacidad', texto: 'Quiero saber qué datos tienen míos <script>', mail: 'yo@ejemplo.com' });
  ok(corto.st === 400 && malMail.st === 400 && bueno.st === 201, 'contacto: muy corto o con un mail mal escrito, no; bien, sí');
  const lista = await api('/api/admin/contacto', { headers: { 'X-Admin': 'clave-admin' } }), sinClave = await api('/api/admin/contacto');
  ok(sinClave.st === 403 && lista.j.mensajes.length === 1 && lista.j.mensajes[0].motivo === 'privacidad' && lista.j.mensajes[0].mail === 'yo@ejemplo.com', 'los mensajes se ven en moderación (y sólo con la clave)');
  for (let i = 0; i < 4; i++) await c({ motivo: 'otro', texto: 'mensaje de prueba número ' + i });
  ok((await c({ motivo: 'otro', texto: 'uno más de la cuenta' })).st === 429, 'más de 5 mensajes por día desde la misma conexión: no');
}
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`); srv.close(); process.exit(fallas ? 1 : 0);
