// ---------------- el motor de WhatsApp de Stickerazo (corre en Node dentro de la app: nodejs-mobile) ----------------
// WhatsApp todavía no deja que las apps agreguen stickers con sonido a sus packs, pero un sticker con sonido es, en su
// protocolo, un mensaje de sticker (el WebP) con una nota de voz adentro (StickerMessage.audioMessage, campo 26). Este motor
// se vincula al WhatsApp del usuario como un dispositivo más (como WhatsApp Web, con el código de 8 dígitos) y manda ese
// mensaje: por defecto a su propio chat, de donde lo guarda en favoritos y lo usa en cualquier lado.
// Para no quedar conectado todo el tiempo: se conecta sólo para mandar y se desconecta al terminar (la vinculación queda
// guardada); y con «desvincular después» se borra del todo. Nada de mensajes a desconocidos ni en cantidad.
// La app (Java) lo arranca una vez y le habla por HTTP en 127.0.0.1 con un token: GET /estado, POST /vincular {numero},
// POST /enviar {webp, ogg (base64), segundos, destino, desvincular}, POST /grupos, POST /desvincular.
// uso: node main.mjs CARPETA_DATOS TOKEN [PUERTO]   (escribe el puerto en CARPETA_DATOS/puerto.txt)
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;   // (Node 18 —el de nodejs-mobile— no lo trae puesto)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const DIR = process.argv[2] || './datos', TOKEN = process.argv[3] || '', PUERTO = +process.argv[4] || 0;
const SESION = path.join(DIR, 'sesion'); fs.mkdirSync(DIR, { recursive: true });
const MAX_SEG = 60, MAX_POR_HORA = 20, MAX_WEBP = 1 << 20, MAX_OGG = 2 << 20;
let B = null, sock = null, abierto = false, codigo = null, error = null, ocupado = Promise.resolve(), envios = [];
const cargar = async () => (B ||= await import('baileys'));
const log = (...a) => { try { fs.appendFileSync(path.join(DIR, 'motor.log'), new Date().toISOString() + ' ' + a.join(' ') + '\n'); } catch (e) { /* nada */ } };
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const vinculado = () => { try { return !!JSON.parse(fs.readFileSync(path.join(SESION, 'creds.json'), 'utf8')).registered; } catch (e) { return false; } };
const yo = () => { try { const c = JSON.parse(fs.readFileSync(path.join(SESION, 'creds.json'), 'utf8')); return c.me && c.me.id ? c.me.id.replace(/:\d+@/, '@') : null; } catch (e) { return null; } };

// (de a una cosa por vez: conectar, mandar y desconectar no se pisan)
const enFila = (f) => { const p = ocupado.then(f, f); ocupado = p.catch(() => {}); return p; };

// conectarse con la sesión guardada (o empezar una nueva: con `numero`, pide el código de vinculación)
async function conectar(numero) {
  const b = await cargar(); const { default: pino } = await import('pino');
  const { state, saveCreds } = await b.useMultiFileAuthState(SESION);
  let version; try { version = (await b.fetchLatestBaileysVersion()).version; } catch (e) { /* la que trae */ }
  return await new Promise((ok, mal) => {
    let listo = false, pedido = false;
    const abrir = () => {
      const s = b.makeWASocket({ auth: state, version, logger: pino({ level: 'silent' }), browser: b.Browsers.macOS('Desktop'),
        markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false, generateHighQualityLinkPreview: false, getMessage: async () => undefined });
      sock = s; s.ev.on('creds.update', saveCreds);
      s.ev.on('connection.update', async (u) => {
        if ((u.qr || u.connection === 'connecting') && numero && !state.creds.registered && !pedido) {
          pedido = true;
          try { await espera(1200); codigo = await s.requestPairingCode(numero.replace(/\D/g, '')); log('código pedido'); if (!listo) { listo = true; ok({ codigo }); } }
          catch (e) { error = 'No se pudo pedir el código: ' + e.message; if (!listo) { listo = true; mal(new Error(error)); } }
        }
        if (u.connection === 'open') { abierto = true; codigo = null; error = null; log('conectado'); if (!listo) { listo = true; ok({ abierto: true }); } }
        if (u.connection === 'close') {
          abierto = false; const r = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output ? u.lastDisconnect.error.output.statusCode : 0;
          log('se cerró', r);
          // (al vincular, WhatsApp pide reconectar una vez con la sesión nueva)
          if (r === b.DisconnectReason.restartRequired) { abrir(); return; }
          if (r === b.DisconnectReason.loggedOut) { try { fs.rmSync(SESION, { recursive: true, force: true }); } catch (e) { /* nada */ } error = 'Se desvinculó desde WhatsApp'; }
          if (!listo) { listo = true; mal(new Error(error || 'WhatsApp cortó la conexión (' + r + ')')); }
        }
      });
    };
    abrir();
    setTimeout(() => { if (!listo) { listo = true; mal(new Error('WhatsApp no respondió')); } }, 45000);
  });
}
async function desconectar() { if (sock) { try { sock.end(undefined); } catch (e) { /* nada */ } } sock = null; abierto = false; }

// el sticker con sonido: el WebP como sticker y el Ogg/Opus como nota de voz adentro (campo 26)
async function enviar({ webp, ogg, segundos, destino, desvincular, animado }) {
  if (!vinculado()) throw new Error('Primero vinculá tu WhatsApp');
  const ahora = Date.now(); envios = envios.filter((t) => ahora - t < 3600e3);
  if (envios.length >= MAX_POR_HORA) throw new Error('Esperá un rato: van muchos en una hora');
  const st = Buffer.from(String(webp || ''), 'base64'), au = Buffer.from(String(ogg || ''), 'base64');
  if (st.length < 30 || st.length > MAX_WEBP || st.toString('latin1', 0, 4) !== 'RIFF' || st.toString('latin1', 8, 12) !== 'WEBP') throw new Error('El sticker no es un WebP');
  if (au.length < 30 || au.length > MAX_OGG || au.toString('latin1', 0, 4) !== 'OggS') throw new Error('El audio no es Ogg/Opus');
  const seg = Math.max(1, Math.min(MAX_SEG, Math.round(+segundos || 1)));
  const b = await cargar();
  if (!abierto) await conectar();
  try {
    const para = destino === 'yo' || !destino ? yo() : /@/.test(destino) ? destino : String(destino).replace(/\D/g, '') + '@s.whatsapp.net';
    if (!para) throw new Error('No sé cuál es tu número');
    const opc = { upload: sock.waUploadToServer };
    const m1 = await b.prepareWAMessageMedia({ sticker: st, isAnimated: !!animado }, opc);
    const m2 = await b.prepareWAMessageMedia({ audio: au, ptt: true, mimetype: 'audio/ogg; codecs=opus', seconds: seg }, opc);
    m1.stickerMessage.audioMessage = m2.audioMessage;
    if (animado) m1.stickerMessage.isAnimated = true;
    const msg = b.generateWAMessageFromContent(para, { stickerMessage: m1.stickerMessage }, { userJid: sock.user.id });
    await sock.relayMessage(para, msg.message, { messageId: msg.key.id });
    envios.push(Date.now()); log('mandado a', para === yo() ? 'mí' : 'otro', seg + ' s');
    await espera(2500);   // (que termine de salir)
    return { ok: true, id: msg.key.id, para: para === yo() ? 'yo' : para };
  } finally {
    if (desvincular) { try { await sock.logout(); } catch (e) { /* nada */ } try { fs.rmSync(SESION, { recursive: true, force: true }); } catch (e) { /* nada */ } }
    await desconectar();
  }
}
async function grupos() {
  if (!vinculado()) throw new Error('Primero vinculá tu WhatsApp');
  if (!abierto) await conectar();
  try { const g = await sock.groupFetchAllParticipating(); return Object.values(g).map((x) => ({ id: x.id, nombre: x.subject || 'Grupo' })).sort((a, b) => a.nombre.localeCompare(b.nombre)).slice(0, 200); }
  finally { await desconectar(); }
}

// ---------------- lo que pide la app ----------------
const leer = (q) => new Promise((ok, mal) => { let n = 0; const p = []; q.on('data', (d) => { n += d.length; if (n > 8 << 20) { mal(new Error('muy grande')); q.destroy(); } else p.push(d); }); q.on('end', () => { try { ok(p.length ? JSON.parse(Buffer.concat(p).toString('utf8')) : {}); } catch (e) { mal(e); } }); });
const srv = http.createServer(async (q, r) => {
  const responder = (cod, o) => { r.writeHead(cod, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };
  if (q.headers['x-token'] !== TOKEN) return responder(403, { ok: false, error: 'no' });
  try {
    const ruta = new URL(q.url, 'http://x').pathname, d = q.method === 'POST' ? await leer(q) : {};
    if (ruta === '/estado') return responder(200, { ok: true, vinculado: vinculado(), yo: yo() ? yo().split('@')[0].replace(/\d(?=\d{4})/g, '•') : null, conectado: abierto, codigo, error });
    if (ruta === '/vincular') { if (vinculado()) return responder(200, { ok: true, ya: true }); codigo = null; error = null; const x = await enFila(() => conectar(d.numero)); return responder(200, { ok: true, codigo: x.codigo || codigo }); }
    if (ruta === '/enviar') return responder(200, await enFila(() => enviar(d)));
    if (ruta === '/grupos') return responder(200, { ok: true, lista: await enFila(() => grupos()) });
    if (ruta === '/desvincular') { await enFila(async () => { if (vinculado()) { if (!abierto) await conectar().catch(() => {}); try { await sock.logout(); } catch (e) { /* nada */ } } await desconectar(); fs.rmSync(SESION, { recursive: true, force: true }); }); return responder(200, { ok: true }); }
    responder(404, { ok: false, error: 'no hay ' + ruta });
  } catch (e) { log('error', e && e.message); responder(200, { ok: false, error: String((e && e.message) || e) }); }
});
srv.listen(PUERTO, '127.0.0.1', () => { const p = srv.address().port; fs.writeFileSync(path.join(DIR, 'puerto.txt'), String(p)); log('escuchando en', p); });
export { enviar, conectar, vinculado };
