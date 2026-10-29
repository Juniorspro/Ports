// Servidor estatico para pruebas locales con soporte de Range: node servidor.js PUERTO dir1 [dir2 ...]  (busca los archivos en cada dir)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const [, , puerto, ...dirs] = process.argv;
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain', '.bin': 'application/octet-stream', '.dz': 'application/octet-stream' };
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  let f = null; for (const d of dirs) { const c = path.join(d, path.normalize(u).replace(/^(\.\.[/\\])+/, '')); if (fs.existsSync(c) && fs.statSync(c).isFile()) { f = c; break; } }
  if (!f) { res.writeHead(404); res.end('no'); return; }
  const st = fs.statSync(f), tipo = tipos[path.extname(f)] || 'application/octet-stream';
  const h = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  if (m) {
    const a = Number(m[1]), b = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
    fs.createReadStream(f, { start: a, end: b }).pipe(res);
  } else { res.writeHead(200, { ...h, 'Content-Length': st.size }); fs.createReadStream(f).pipe(res); }
}).listen(Number(puerto), '127.0.0.1', () => console.log('servidor en http://127.0.0.1:' + puerto));
