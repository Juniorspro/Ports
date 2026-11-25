// web/ogg.js: un audio de 3 s y uno de 60 s (estéreo, 44,1 kHz) pasan a Ogg/Opus en Chromium y ffmpeg los lee enteros.
// uso: node ogg.mjs
import { createRequire } from 'module'; import fs from 'fs'; import http from 'http'; import path from 'path'; import { execSync } from 'child_process';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const WEB = '/home/user/Ports/porteos/stickerazo/web/', SAL = '/tmp/claude-0/sz_ogg'; fs.mkdirSync(SAL, { recursive: true });
const srv = http.createServer((q, r) => { const f = path.join(WEB, new URL(q.url, 'http://x').pathname); if (!f.startsWith(WEB) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); });
await new Promise((ok) => srv.listen(8997, ok));
let fallas = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
await p.goto('http://127.0.0.1:8997/index.html').catch(() => {});
for (const seg of [3, 60]) {
  const b64 = await p.evaluate(async (seg) => {
    const { oggOpus, puedeOpus } = await import('/ogg.js'); if (!puedeOpus()) return 'sin';
    const sr = 44100, ctx = new OfflineAudioContext(2, sr * seg, sr), buf = ctx.createBuffer(2, sr * seg, sr);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = 0.4 * Math.sin(2 * Math.PI * (330 + c * 110) * i / sr); }
    const bl = await oggOpus(buf, 48), u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s);
  }, seg);
  if (b64 === 'sin') { ok(false, 'el navegador no tiene AudioEncoder'); break; }
  const f = `${SAL}/a${seg}.ogg`; fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  const info = execSync(`ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate,channels -of json "${f}"`).toString(), j = JSON.parse(info);
  let err = ''; try { execSync(`ffmpeg -v error -i "${f}" -f null - 2>&1`).toString(); } catch (e) { err = String(e.stdout || e.message).slice(0, 200); }
  const dur = +j.format.duration, st = j.streams[0];
  ok(st.codec_name === 'opus' && Math.abs(dur - seg) < 0.08 && !err, `${seg} s → Ogg/Opus que ffmpeg lee entero`, { kb: Math.round(fs.statSync(f).size / 1024), dur, canales: st.channels, hz: st.sample_rate, err });
}
await b.close(); srv.close(); console.log(fallas ? fallas + ' FALLAS' : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
