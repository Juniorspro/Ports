// ---------------- los correos de JXMod: por Gmail, sin ningún servicio aparte ----------------
// Los manda la cuenta de Gmail del juego por su servidor SMTP (smtp.gmail.com:465, con TLS) con una «contraseña de
// aplicación» de esa cuenta (Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones). Las dos van como
// variables del worker en el panel de Cloudflare (no en el repo): GMAIL_USUARIO (la dirección) y GMAIL_CLAVE (la
// contraseña de aplicación, como secreto). Sin ellas los correos quedan apagados (y el registro por Gmail no aparece).
// Gmail deja mandar unos 500 por día desde una cuenta común: el tope de acá es CORREO_DIA.
// La conexión (connect de cloudflare:sockets) la pone worker.js con correoConector, así este archivo también se puede
// usar en Node para las pruebas (con otro conector, o con CORREO_PRUEBA=1: los correos quedan en una lista en memoria).
export const CORREO_DIA = 450;
const enc = new TextEncoder(), dec = new TextDecoder();
let conectar = null;
export const correoConector = (f) => { conectar = f; };
export const correoActivo = (env) => !!(env && (env.CORREO_PRUEBA || (env.GMAIL_USUARIO && env.GMAIL_CLAVE)));
export const CORREOS_PRUEBA = [];

// sólo direcciones de Gmail; la «canónica» (sin puntos ni +algo, que Gmail ignora) identifica la cuenta
export function gmailNormal(c) {
  const s = String(c || '').trim().toLowerCase(), m = /^([a-z0-9][a-z0-9.+_-]{0,63})@(gmail\.com|googlemail\.com)$/.exec(s);
  if (!m) return null;
  const local = m[1].split('+')[0].replace(/\./g, '');
  if (!/^[a-z0-9]{6,30}$/.test(local)) return null;   // (Gmail: de 6 a 30 letras y números, y puntos que no cuentan)
  return { dir: m[1] + '@' + m[2], canon: local + '@gmail.com' };
}

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
const encabezado = (t) => (/^[\x20-\x7e]*$/.test(t) ? t : '=?UTF-8?B?' + b64(enc.encode(t)) + '?=');
function armar(de, m) {
  const cuerpo = b64(enc.encode(String(m.texto || '').replace(/\r?\n/g, '\r\n'))).replace(/.{1,76}/g, '$&\r\n');
  const id = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const cab = [
    'From: ' + encabezado(m.nombreDe || 'JXMod') + ' <' + de + '>',
    'To: <' + m.para + '>',
    'Subject: ' + encabezado(String(m.asunto || 'JXMod').slice(0, 150)),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + id + '@jxmod>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (m.baja) cab.push('List-Unsubscribe: <' + m.baja + '>', 'List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  return cab.join('\r\n') + '\r\n\r\n' + cuerpo;
}

// manda una tanda en una sola conexión; devuelve { ok, mal: [{para, error}] }
export async function correoMandar(env, lista) {
  const L = (lista || []).filter((m) => m && /^[^\s<>@]+@[^\s<>@]+$/.test(m.para));
  if (!L.length) return { ok: 0, mal: [] };
  if (env.CORREO_PRUEBA) { for (const m of L) CORREOS_PRUEBA.push({ ...m, de: env.GMAIL_USUARIO || 'prueba@gmail.com', crudo: armar(env.GMAIL_USUARIO || 'prueba@gmail.com', m) }); return { ok: L.length, mal: [] }; }
  if (!correoActivo(env)) throw new Error('correo sin configurar');
  if (!conectar) throw new Error('sin conexión para el correo');
  const usuario = String(env.GMAIL_USUARIO).trim(), clave = String(env.GMAIL_CLAVE).replace(/\s+/g, '');
  const s = conectar({ hostname: env.SMTP_HOST || 'smtp.gmail.com', port: +env.SMTP_PUERTO || 465 }, { secureTransport: 'on', allowHalfOpen: false });
  const w = s.writable.getWriter(), rd = s.readable.getReader();
  let buf = '', lineas = [];
  const respuesta = async () => {
    for (;;) {
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 2); lineas.push(l);
        if (/^\d{3}( |$)/.test(l)) { const t = lineas.join('\n'); lineas = []; return { c: +l.slice(0, 3), t }; }
      }
      const { value, done } = await rd.read(); if (done) throw new Error('el servidor de correo cortó');
      buf += dec.decode(value, { stream: true });
    }
  };
  const cmd = async (x, esperados) => {
    if (x != null) await w.write(enc.encode(x + '\r\n'));
    const r = await respuesta(); if (!esperados.includes(r.c)) throw new Error('SMTP ' + r.c + ': ' + r.t.slice(0, 160));
    return r;
  };
  let ok = 0; const mal = [];
  try {
    await cmd(null, [220]); await cmd('EHLO jxmod', [250]);
    await cmd('AUTH PLAIN ' + b64(enc.encode('\0' + usuario + '\0' + clave)), [235]);
    for (const m of L) {
      try {
        await cmd('MAIL FROM:<' + usuario + '>', [250]); await cmd('RCPT TO:<' + m.para + '>', [250, 251]); await cmd('DATA', [354]);
        await w.write(enc.encode(armar(usuario, m) + '\r\n.\r\n')); await cmd(null, [250]); ok++;
      } catch (e) { mal.push({ para: m.para, error: String(e.message || e).slice(0, 200) }); try { await cmd('RSET', [250]); } catch (x) { break; } }
    }
    try { await cmd('QUIT', [221]); } catch (e) {}
  } finally { try { await w.close(); } catch (e) {} try { s.close && (await s.close()); } catch (e) {} }
  for (const m of L.slice(ok + mal.length)) mal.push({ para: m.para, error: 'no se llegó a mandar' });
  return { ok, mal };
}

// cuántos se mandaron hoy (el tope de Gmail), en la tabla conf
export async function correoCupo(env, n) {
  const k = 'correos:' + new Date().toISOString().slice(0, 10);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS conf (k TEXT PRIMARY KEY, v TEXT)').run();
  if (n) await env.DB.prepare("INSERT INTO conf (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = CAST(v AS INTEGER) + ?2").bind(k, n).run();
  const f = await env.DB.prepare('SELECT v FROM conf WHERE k = ?1').bind(k).first();
  return CORREO_DIA - (f ? +f.v || 0 : 0);
}
// una clave al azar del servidor (para firmar los enlaces de «no quiero más correos»), creada la primera vez
export async function claveServidor(env, nombre) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS conf (k TEXT PRIMARY KEY, v TEXT)').run();
  let f = await env.DB.prepare('SELECT v FROM conf WHERE k = ?1').bind('clave:' + nombre).first();
  if (!f) {
    const v = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('INSERT OR IGNORE INTO conf (k, v) VALUES (?1, ?2)').bind('clave:' + nombre, v).run();
    f = await env.DB.prepare('SELECT v FROM conf WHERE k = ?1').bind('clave:' + nombre).first();
  }
  return f.v;
}
export async function hmacHex(clave, txt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(txt)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
