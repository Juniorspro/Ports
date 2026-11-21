// Los carteles del inicio (web/banners/*.webp, 1200×510; también portadas de perfil y la bienvenida), armados con las
// pegatinas propias de la app (web/pegatinas.js): un degradé, unos brillos y las pegatinas con su borde blanco, a la
// derecha (a la izquierda va el texto del cartel). uso: node herramientas/banners_pegatinas.mjs
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const WEB = new URL('../web/', import.meta.url).pathname;
const srv = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (u === '/h.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end('<!doctype html><body></body>'); } const f = path.join(WEB, u); if (!f.startsWith(WEB) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'font/ttf' }); fs.createReadStream(f).pipe(r); }).listen(8977);
const ESCENAS = {
  xd: { de: '#24093f', a: '#ff3e8a', pegas: ['xd', 'g_wow', 'loco', 'muerto', 'cool', 'fuego', 'g_jaja', 'sorpresa', 'chispas', 'risa'] },
  latam: { de: '#0b3d2a', a: '#ffb21a', pegas: ['empanada', 'pelota', 'sol', 'termo', 'medialuna', 'alfajor', 'chori', 'camiseta', 'ddl', 'mate'] },
  pack: { de: '#13205e', a: '#3ec7ff', pegas: ['g_ok', 'corazon', 'estrella', 'amor', 'globoF', 'brillo', 'ojitos', 'g_si', 'estrellitas', 'regalo'] },
};
// (x, y, tamaño, giro): la última es la grande del medio
const LUGARES = [[715, 105, 140, 0.2], [1105, 100, 160, -0.15], [725, 412, 140, -0.12], [1108, 405, 160, 0.12], [862, 52, 92, 0.3], [1005, 472, 100, -0.2], [660, 262, 96, 0.15], [1172, 262, 92, -0.3], [628, 470, 66, 0.25], [912, 262, 270, -0.07]];
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://127.0.0.1:8977/h.html');
const salida = await p.evaluate(async ({ ESCENAS, LUGARES }) => {
  for (const f of ['LuckiestGuy']) { const ff = new FontFace(f, `url(/fuentes/${f}.ttf)`); await ff.load(); document.fonts.add(ff); }
  const { PEGA, dibujarPega } = await import('/pegatinas.js');
  const out = {};
  for (const [k, E] of Object.entries(ESCENAS)) {
    const W = 1200, H = 510, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, E.de); gr.addColorStop(1, E.a); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (const [x, y, r, a] of [[880, 250, 360, 0.35], [300, 520, 300, 0.18], [1150, -40, 260, 0.25]]) { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    g.fillStyle = 'rgba(255,255,255,0.14)'; for (let i = 0; i < 70; i++) { const x = (i * 173.7) % W, y = (i * 97.3 + (i % 7) * 41) % H; g.beginPath(); g.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); g.fill(); }
    // (lo de la izquierda más oscuro: ahí va el texto)
    const os = g.createLinearGradient(0, 0, W * 0.55, 0); os.addColorStop(0, 'rgba(0,0,0,0.45)'); os.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = os; g.fillRect(0, 0, W, H);
    E.pegas.forEach((id, i) => {
      const [x, y, t, rot] = LUGARES[i], tmp = document.createElement('canvas'); tmp.width = tmp.height = t; dibujarPega(tmp.getContext('2d'), PEGA[id], t);
      g.save(); g.translate(x, y); g.rotate(rot);
      const o = Math.max(4, t * 0.035), sombras = Array.from({ length: 8 }, (_, j) => `drop-shadow(${(o * Math.cos((j * Math.PI) / 4)).toFixed(1)}px ${(o * Math.sin((j * Math.PI) / 4)).toFixed(1)}px 0 #fff)`).join(' ');
      g.filter = `${sombras} drop-shadow(0 ${Math.round(t * 0.05)}px ${Math.round(t * 0.06)}px rgba(0,0,0,0.45))`; g.drawImage(tmp, -t / 2, -t / 2); g.restore();
    });
    out[k] = c.toDataURL('image/webp', 0.86);
  }
  return out;
}, { ESCENAS, LUGARES });
for (const [k, u] of Object.entries(salida)) { const buf = Buffer.from(u.split(',')[1], 'base64'); fs.writeFileSync(path.join(WEB, 'banners', k + '.webp'), buf); console.log(k, (buf.length / 1024).toFixed(1) + ' KB'); }
await b.close(); srv.close();
