// «¿De dónde sos?» a pantalla completa: el mundo en puntos (Natural Earth, dominio público) que viaja hasta el país que
// elegís en la tira de banderas de abajo. Lo usan la bienvenida, el inicio y el perfil.
import { MAPA, PAISES } from './mapa.js';

const BITS = Uint8Array.from(atob(MAPA.bits), (c) => c.charCodeAt(0));
const TIERRA = []; for (let f = 0; f < MAPA.h; f++) for (let c = 0; c < MAPA.w; c++) { const k = f * MAPA.w + c; if (BITS[k >> 3] & (1 << (k & 7))) TIERRA.push(c, f); }
export const LISTA_PAISES = [...PAISES, { k: 'otro', f: '🌎', n: 'Otro país', lon: 0, lat: 20 }];
// (columna y fila del mapa de un lugar)
const aGrilla = (lon, lat) => [(lon + 180) / MAPA.paso - 0.5, (MAPA.norte - lat) / MAPA.paso - 0.5];

// abre la pantalla; listo(código) cuando elige. inicial: el país de antes (o el primero)
export function elegirPaisMapa({ inicial, titulo = '¿De dónde sos?', sub = 'Te muestro primero los memes de tu país', listo, cerrar, vibrar = () => {} }) {
  const el = document.createElement('div'); el.className = 'mapaPais';
  el.innerHTML = `<canvas></canvas><div class="mpArriba"><h2>${titulo}</h2><p>${sub}</p></div>${cerrar ? '<button class="mpCerrar" aria-label="Cerrar">✕</button>' : ''}
    <div class="mpAbajo"><div class="mpTira">${LISTA_PAISES.map((p) => `<button data-p="${p.k}"><span>${p.f}</span><small>${p.n}</small></button>`).join('')}</div>
    <button class="grande mpListo"><span class="mpEleccion"></span></button></div>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), tira = el.querySelector('.mpTira'), boton = el.querySelector('.mpListo');
  let elegido = LISTA_PAISES.find((p) => p.k === inicial) || LISTA_PAISES[0], vivo = true;
  // la cámara: dónde mira (columna, fila) y cuánto se acerca; arranca lejos y viaja
  const cam = { x: aGrilla(-40, 15)[0], y: aGrilla(-40, 15)[1], z: 0.3 }, meta = { x: 0, y: 0, z: 1 };
  const apuntar = (p) => { const [x, y] = aGrilla(p.lon, p.lat); meta.x = x; meta.y = y; meta.z = p.k === 'otro' ? 0.34 : 0.62; };
  const dpr = Math.min(2, devicePixelRatio || 1);
  const medir = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  medir(); addEventListener('resize', medir);
  const t0 = performance.now();
  const cuadro = (ahora) => {
    if (!vivo) return;
    const t = (ahora - t0) / 1000, W = cv.width, H = cv.height;
    cam.x += (meta.x - cam.x) * 0.06; cam.y += (meta.y - cam.y) * 0.06; cam.z += (meta.z - cam.z) * 0.05;
    const cel = (H / MAPA.h) * 1.35 * cam.z, cx = W / 2, cy = H * 0.42, r = Math.max(1, cel * 0.3);
    g.clearRect(0, 0, W, H);
    const [px, py] = aGrilla(elegido.lon, elegido.lat);
    for (let i = 0; i < TIERRA.length; i += 2) {
      const c = TIERRA[i], f = TIERRA[i + 1];
      let x = cx + (c - cam.x) * cel; const y = cy + (f - cam.y) * cel;
      const ancho = MAPA.w * cel; x = ((x % ancho) + ancho) % ancho; if (x > W + cel) x -= ancho;   // (da la vuelta al mundo)
      if (x < -cel || x > W + cel || y < -cel || y > H + cel) continue;
      // (cerca del país elegido brilla; algunos puntos titilan)
      const d = elegido.k === 'otro' ? 99 : Math.hypot(c - px, f - py), cerca = Math.max(0, 1 - d / 7), tit = 0.5 + 0.5 * Math.sin(t * 1.7 + c * 0.7 + f * 1.3);
      g.fillStyle = cerca > 0 ? `rgba(255,${Math.round(62 + 148 * (1 - cerca))},${Math.round(138 * (1 - cerca) + 40)},${0.35 + 0.6 * cerca})` : `rgba(160,150,200,${0.16 + 0.12 * tit})`;
      g.beginPath(); g.arc(x, y, r * (1 + 0.5 * cerca), 0, 6.283); g.fill();
    }
    // los demás países: puntitos; el elegido: anillos que laten y su bandera
    for (const p of PAISES) {
      const [a, b] = aGrilla(p.lon, p.lat), x = cx + (a - cam.x) * cel, y = cy + (b - cam.y) * cel;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      if (p === elegido) continue;
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x, y, 2.4 * dpr, 0, 6.283); g.fill();
    }
    if (elegido.k !== 'otro') {
      const x = cx + (px - cam.x) * cel, y = cy + (py - cam.y) * cel;
      for (let k = 0; k < 3; k++) { const q = ((t * 0.7 + k / 3) % 1); g.strokeStyle = `rgba(255,62,138,${0.7 * (1 - q)})`; g.lineWidth = 2.5 * dpr; g.beginPath(); g.arc(x, y, (8 + q * 46) * dpr, 0, 6.283); g.stroke(); }
      const s = 46 * dpr, bob = Math.sin(t * 3) * 3 * dpr;
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x - s / 2, y - s - 18 * dpr + bob, s, s, 14 * dpr); g.fill();
      g.beginPath(); g.moveTo(x - 7 * dpr, y - 19 * dpr + bob); g.lineTo(x + 7 * dpr, y - 19 * dpr + bob); g.lineTo(x, y - 9 * dpr + bob); g.fill();
      g.font = `${28 * dpr}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(elegido.f, x, y - s / 2 - 18 * dpr + bob + 1);
      g.fillStyle = '#ff3e8a'; g.beginPath(); g.arc(x, y, 5 * dpr, 0, 6.283); g.fill();
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
  // la tira: la bandera del medio es la elegida (el mapa viaja hasta ahí)
  const marcar = (p, mover) => {
    if (p !== elegido) vibrar(5);
    elegido = p; apuntar(p);
    for (const b of tira.children) b.classList.toggle('act', b.dataset.p === p.k);
    el.querySelector('.mpEleccion').textContent = p.k === 'otro' ? 'Soy de otro lado 🌎' : `Soy de ${p.n} ${p.f}`;
    if (mover) { const b = tira.querySelector(`[data-p="${p.k}"]`); tira.scrollTo({ left: b.offsetLeft - (tira.clientWidth - b.offsetWidth) / 2, behavior: mover === 'ya' ? 'auto' : 'smooth' }); }
  };
  let rel = 0;
  tira.addEventListener('scroll', () => { clearTimeout(rel); rel = setTimeout(() => {
    const medio = tira.scrollLeft + tira.clientWidth / 2; let mejor = null, dm = 1e9;
    for (const b of tira.children) { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - medio); if (d < dm) { dm = d; mejor = b; } }
    if (mejor) marcar(LISTA_PAISES.find((p) => p.k === mejor.dataset.p));
  }, 70); }, { passive: true });
  tira.onclick = (ev) => { const b = ev.target.closest('[data-p]'); if (b) marcar(LISTA_PAISES.find((p) => p.k === b.dataset.p), true); };
  const fin = (k) => { vivo = false; removeEventListener('resize', medir); el.classList.add('chau'); setTimeout(() => el.remove(), 420); if (k) listo(k); else if (cerrar) cerrar(); };
  boton.onclick = () => fin(elegido.k);
  const x = el.querySelector('.mpCerrar'); if (x) x.onclick = () => fin(null);
  requestAnimationFrame(() => { marcar(elegido, 'ya'); el.classList.add('entra'); });
  return { cerrar: () => fin(null), el };
}
