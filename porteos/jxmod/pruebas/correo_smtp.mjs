// El envío de correos (tienda/correo.js) contra un servidor SMTP de mentira con TLS (como smtp.gmail.com:465), acá:
//  1. entra con AUTH PLAIN con el usuario y la contraseña de aplicación (sin los espacios con que la muestra Google);
//  2. manda una tanda en una sola conexión; el asunto con acentos va codificado, el texto en base64 UTF-8, con
//     List-Unsubscribe cuando hay enlace de baja; una dirección que el servidor rechaza queda en «mal» y las demás salen;
//  3. con la contraseña mal, falla sin mandar nada;
//  4. las direcciones de Gmail: sólo @gmail.com/@googlemail.com, y la canónica sin puntos ni +algo.
// uso: node correo_smtp.mjs
import tls from 'tls'; import { execFileSync } from 'child_process'; import fs from 'fs'; import { Readable, Writable } from 'stream';
import { correoMandar, correoConector, gmailNormal } from '../tienda/correo.js';
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 300) : '')); };
const D = fs.mkdtempSync('/tmp/claude-0/smtp_'); execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', D + '/k.pem', '-out', D + '/c.pem', '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
const RECIBIDOS = [], AUTH = [];
const srv = tls.createServer({ key: fs.readFileSync(D + '/k.pem'), cert: fs.readFileSync(D + '/c.pem') }, (s) => {
  let buf = '', enDatos = false, msg = null;
  const di = (x) => s.write(x + '\r\n'); di('220 smtp de prueba');
  s.on('data', (d) => {
    buf += d.toString('latin1');
    for (;;) {
      if (enDatos) { const i = buf.indexOf('\r\n.\r\n'); if (i < 0) return; msg.datos = buf.slice(0, i); buf = buf.slice(i + 5); enDatos = false; RECIBIDOS.push(msg); di('250 2.0.0 OK'); continue; }
      const i = buf.indexOf('\r\n'); if (i < 0) return; const l = buf.slice(0, i); buf = buf.slice(i + 2);
      if (/^EHLO/i.test(l)) { s.write('250-smtp de prueba\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n'); }
      else if (/^AUTH PLAIN /i.test(l)) { const [, u, p] = Buffer.from(l.slice(11), 'base64').toString().split('\0'); AUTH.push([u, p]); di(u === 'juego@gmail.com' && p === 'abcdefghijklmnop' ? '235 2.7.0 Accepted' : '535 5.7.8 Username and Password not accepted'); }
      else if (/^MAIL FROM:/i.test(l)) { msg = { de: l.slice(10) }; di('250 OK'); }
      else if (/^RCPT TO:/i.test(l)) { msg.para = l.slice(8); di(/rechazo/.test(l) ? '550 5.1.1 no existe' : '250 OK'); }
      else if (/^DATA/i.test(l)) { enDatos = true; di('354 Go ahead'); }
      else if (/^RSET/i.test(l)) { msg = null; di('250 OK'); }
      else if (/^QUIT/i.test(l)) { di('221 bye'); s.end(); }
      else di('502 no');
    }
  });
  s.on('error', () => {});
}).listen(0);
const PUERTO = srv.address().port;
correoConector((addr, o) => { const s = tls.connect({ host: '127.0.0.1', port: PUERTO, rejectUnauthorized: false }); return { readable: Readable.toWeb(s), writable: Writable.toWeb(s), close: () => s.end() }; });
const env = { GMAIL_USUARIO: 'juego@gmail.com', GMAIL_CLAVE: 'abcd efgh ijkl mnop' };
const r = await correoMandar(env, [
  { para: 'ana.perez@gmail.com', asunto: 'Tu código de JXMod: 123456', texto: 'Hola,\nTu código es 123456.\n— JXMod' },
  { para: 'rechazo@gmail.com', asunto: 'x', texto: 'x' },
  { para: 'beto@gmail.com', asunto: 'Novedades: ¡evento!', texto: 'Línea 1\n.\nLínea con punto', baja: 'https://x/api/cuenta/baja?u=1&k=2' },
]);
chk(AUTH[0] && AUTH[0][0] === 'juego@gmail.com' && AUTH[0][1] === 'abcdefghijklmnop', '1. entra con el usuario y la contraseña de aplicación (sin espacios)', AUTH[0]);
const dec = (m) => { const [cab, cuerpo] = m.datos.split('\r\n\r\n'); return { cab, texto: Buffer.from(cuerpo.replace(/\r\n/g, ''), 'base64').toString('utf8') }; };
const m0 = RECIBIDOS[0] && dec(RECIBIDOS[0]), m1 = RECIBIDOS[1] && dec(RECIBIDOS[1]);
const asunto = m0 && /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(m0.cab);
chk(r.ok === 2 && r.mal.length === 1 && r.mal[0].para === 'rechazo@gmail.com' && RECIBIDOS.length === 2, '2. una tanda en una conexión: 2 salen, la rechazada queda en «mal»', r);
chk(asunto && Buffer.from(asunto[1], 'base64').toString() === 'Tu código de JXMod: 123456' && m0.texto === 'Hola,\r\nTu código es 123456.\r\n— JXMod' && /From: JXMod <juego@gmail.com>/.test(m0.cab) && /To: <ana.perez@gmail.com>/.test(m0.cab), '2. asunto con acentos y texto en UTF-8, de JXMod', { asunto: asunto && Buffer.from(asunto[1], 'base64').toString(), texto: m0 && m0.texto });
chk(m1 && /List-Unsubscribe: <https:\/\/x\/api\/cuenta\/baja\?u=1&k=2>/.test(m1.cab) && m1.texto.includes('\r\n.\r\nLínea con punto'), '2. con el enlace de baja, y una línea con un punto solo llega entera', m1 && m1.texto);
let err3 = null; try { await correoMandar({ GMAIL_USUARIO: 'juego@gmail.com', GMAIL_CLAVE: 'mala' }, [{ para: 'ana@gmail.com', asunto: 'x', texto: 'x' }]); } catch (e) { err3 = e.message; }
chk(err3 && /535/.test(err3) && RECIBIDOS.length === 2, '3. con la contraseña mal falla y no manda nada', err3);
const G = ['Ana.Perez+jx@gmail.com', 'anaperez@googlemail.com', 'ana@gmail.com', 'ana.perez@hotmail.com', 'ana perez@gmail.com', ' JUAN.ROMERO99@GMAIL.COM '].map((x) => gmailNormal(x));
chk(G[0] && G[0].canon === 'anaperez@gmail.com' && G[1].canon === 'anaperez@gmail.com' && !G[2] && !G[3] && !G[4] && G[5].dir === 'juan.romero99@gmail.com', '4. sólo Gmail, y la misma cuenta con puntos o +algo', G);
console.log(`\n${ok}/${ok + mal}`); srv.close(); fs.rmSync(D, { recursive: true }); process.exit(mal ? 1 : 0);
