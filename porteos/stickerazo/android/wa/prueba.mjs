// Prueba sin conectarse: el campo 26 ida y vuelta, el mensaje armado por Baileys (subida simulada) y el servidor local.
// uso: node prueba.mjs (con node_modules instalado y parche_proto.mjs aplicado)
import { webcrypto } from 'node:crypto'; if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { spawn, execSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const b = await import('baileys'); let fallas = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'szwa-'));
// (un WebP y un Ogg/Opus de verdad, hechos con ffmpeg)
execSync(`ffmpeg -loglevel error -y -f lavfi -i color=c=red:s=512x512:d=1 -frames:v 1 ${tmp}/s.webp -f lavfi -i sine=f=440:d=3 -c:a libopus -b:a 48k ${tmp}/a.ogg`);
const webp = fs.readFileSync(`${tmp}/s.webp`), ogg = fs.readFileSync(`${tmp}/a.ogg`);
// 1) el campo 26 ida y vuelta
const P = b.proto, m0 = { stickerMessage: { url: 'https://x/y', mimetype: 'image/webp', isAnimated: false, audioMessage: { url: 'https://x/z', mimetype: 'audio/ogg; codecs=opus', seconds: 3, ptt: true } } };
const bin = P.Message.encode(P.Message.fromObject(m0)).finish(), hex = Buffer.from(bin).toString('hex');
ok(hex.includes('d201'), 'el mensaje lleva el campo 26 (etiqueta d2 01)');
const de = P.Message.decode(bin); ok(de.stickerMessage && de.stickerMessage.audioMessage && de.stickerMessage.audioMessage.seconds === 3 && de.stickerMessage.audioMessage.ptt === true, 'y vuelve a leerse con su audio', de.stickerMessage && de.stickerMessage.audioMessage);
// 2) armado con Baileys (la subida simulada: devuelve una dirección)
const subidas = []; const upload = async (_s, o) => { subidas.push(o.mediaType); return { mediaUrl: 'https://mmg.whatsapp.net/v/t62/' + o.mediaType, directPath: '/v/t62/' + o.mediaType }; };
const m1 = await b.prepareWAMessageMedia({ sticker: webp }, { upload }), m2 = await b.prepareWAMessageMedia({ audio: ogg, ptt: true, mimetype: 'audio/ogg; codecs=opus', seconds: 3 }, { upload });
m1.stickerMessage.audioMessage = m2.audioMessage;
const msg = b.generateWAMessageFromContent('5491100000000@s.whatsapp.net', { stickerMessage: m1.stickerMessage }, { userJid: '5491100000000@s.whatsapp.net' });
const bin2 = P.Message.encode(msg.message).finish(), de2 = P.Message.decode(bin2);
ok(subidas.join(',') === 'sticker,ptt' || subidas.join(',') === 'sticker,audio', 'sube el sticker y la nota de voz', subidas);
ok(!!de2.stickerMessage.mediaKey && !!de2.stickerMessage.audioMessage && !!de2.stickerMessage.audioMessage.mediaKey && de2.stickerMessage.audioMessage.ptt, 'el mensaje final: sticker cifrado con su nota de voz cifrada adentro', { stickerBytes: de2.stickerMessage.fileLength && +de2.stickerMessage.fileLength, audioSeg: de2.stickerMessage.audioMessage.seconds, mime: de2.stickerMessage.audioMessage.mimetype });
// 3) el servidor local: token y estado
const p = spawn(process.execPath, ['main.mjs', tmp + '/datos', 'secreto123'], { stdio: 'ignore' });
let puerto = 0; for (let i = 0; i < 50 && !puerto; i++) { await new Promise((r) => setTimeout(r, 100)); try { puerto = +fs.readFileSync(tmp + '/datos/puerto.txt', 'utf8'); } catch (e) { /* todavía no */ } }
const pide = async (ruta, tok, cuerpo) => (await fetch(`http://127.0.0.1:${puerto}${ruta}`, { method: cuerpo ? 'POST' : 'GET', headers: { 'x-token': tok, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })).json();
ok((await pide('/estado', 'otro')).ok === false, 'sin el token no contesta');
const e = await pide('/estado', 'secreto123'); ok(e.ok && e.vinculado === false, 'estado: sin vincular', e);
const env = await pide('/enviar', 'secreto123', { webp: webp.toString('base64'), ogg: ogg.toString('base64'), segundos: 3 }); ok(!env.ok && /vincul/i.test(env.error), 'mandar sin vincular avisa', env);
p.kill(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(fallas ? fallas + ' FALLAS' : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
