// Si se pierde el paquete del juego (estaba fuera del repo): node herramientas/recuperar_web.mjs web CÓDIGO URL_DE_LA_CARPETA SALIDA
// Descifra la web publicada (web/index.html + juego.bin + pk.bin) con un código: deja juego.js (el JS del juego, plano),
// pk.bin (el paquete plano) e idx.json (el índice del paquete, del HTML).
import fs from 'fs'; import crypto from 'crypto'; import zlib from 'zlib';
const [, , W, COD, LUGAR, OUT] = process.argv;
const html = fs.readFileSync(W + '/index.html', 'utf8');
const m = html.match(/const CL = (\{.*?\});/s) || html.match(/CL\s*=\s*(\{"v".*?\})[;,]/s);
if (!m) { console.error('no encuentro CL'); process.exit(1); }
const CL = JSON.parse(m[1]);
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const bits = crypto.pbkdf2Sync(norm(COD) + '|' + LUGAR, Buffer.from(CL.sal, 'base64'), CL.it, 64, 'sha256');
const id = crypto.createHash('sha256').update(bits.subarray(0, 32)).digest('hex').slice(0, 16);
const e = CL.c[id]; if (!e) { console.error('código/lugar no coincide'); process.exit(1); }
const w = Buffer.from(e, 'base64'); const dk = crypto.createDecipheriv('aes-256-gcm', bits.subarray(32), w.subarray(0, 12));
dk.setAuthTag(w.subarray(w.length - 16)); const K = Buffer.concat([dk.update(w.subarray(12, w.length - 16)), dk.final()]);
const jb = fs.readFileSync(W + '/juego.bin'); const dj = crypto.createDecipheriv('aes-256-gcm', K, jb.subarray(0, 12));
dj.setAuthTag(jb.subarray(jb.length - 16)); const gz = Buffer.concat([dj.update(jb.subarray(12, jb.length - 16)), dj.final()]);
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + '/juego.js', zlib.gunzipSync(gz));
const Kp = crypto.createHash('sha256').update(K).update('jxmod-paquete').digest();
const cP = crypto.createDecipheriv('aes-256-ctr', Kp, Buffer.concat([Buffer.from(CL.pn, 'base64'), Buffer.alloc(8)]));
fs.writeFileSync(OUT + '/pk.bin', Buffer.concat([cP.update(fs.readFileSync(W + '/pk.bin')), cP.final()]));
const ix = html.match(/\{"d":\[\d+,\d+\][^<]*?\]\}/); if (ix) fs.writeFileSync(OUT + '/idx.json', ix[0]);
console.log('ok K', K.length, 'juego.js', fs.statSync(OUT + '/juego.js').size, 'pk.bin', fs.statSync(OUT + '/pk.bin').size, 'idx', !!ix);
