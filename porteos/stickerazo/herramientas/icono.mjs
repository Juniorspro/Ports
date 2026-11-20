// El ícono de Stickerazo (dibujo propio): un sticker blanco con la punta despegada y una «S» (Luckiest Guy, Apache-2.0)
// sobre el degradé rosa → naranja de la app. Lo pasa a todos los tamaños de Android (adaptativo: fondo, frente y
// monocromo; y el viejo, cuadrado y redondo) y al de 512 de Play Store.
// uso: node herramientas/icono.mjs   (escribe android/res/mipmap-*/ y marca/icono_512.png)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const RAIZ = new URL('..', import.meta.url).pathname, RES = path.join(RAIZ, 'android/res'), MARCA = path.join(RAIZ, 'marca');
const FUENTE = 'data:font/ttf;base64,' + fs.readFileSync(path.join(RAIZ, 'web/fuentes/LuckiestGuy.ttf')).toString('base64');

// todo en unidades de 108 (el lienzo de un ícono adaptativo; lo que siempre se ve es el círculo de 66 del medio)
const L = 22, R = 9, C = 14; // medio lado del sticker, radio de las esquinas, tamaño de la punta
const forma = `M ${-L + R} ${-L} L ${L - R} ${-L} A ${R} ${R} 0 0 1 ${L} ${-L + R} L ${L} ${L - C} L ${L - C} ${L} L ${-L + R} ${L} A ${R} ${R} 0 0 1 ${-L} ${L - R} L ${-L} ${-L + R} A ${R} ${R} 0 0 1 ${-L + R} ${-L} Z`;
const punta = `M ${L} ${L - C} L ${L - C} ${L - C} L ${L - C} ${L} Z`;
const fondo = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3e8a"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient>
  <radialGradient id="luz" cx="0.28" cy="0.22" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="108" height="108" fill="url(#g)"/><rect width="108" height="108" fill="url(#luz)"/>`;
const letra = (color) => `<text x="0" y="1.5" text-anchor="middle" dominant-baseline="central" font-family="LG" font-size="36" fill="${color}">S</text>`;
const frente = `<defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#5a0b2c" flood-opacity="0.45"/></filter>
  <filter id="s2"><feDropShadow dx="-0.6" dy="-0.6" stdDeviation="0.7" flood-color="#000" flood-opacity="0.25"/></filter></defs>
  <g transform="translate(54 54) rotate(-9)">
    <path d="${forma}" fill="#fff" filter="url(#s)"/>
    ${letra('#ff3e8a')}
    <path d="${punta}" fill="#eadff7" filter="url(#s2)"/>
  </g>
  <g transform="translate(31.5 31)" fill="#ffd23f" filter="url(#s)"><path d="M0 -5.5 L1.4 -1.4 L5.5 0 L1.4 1.4 L0 5.5 L-1.4 1.4 L-5.5 0 L-1.4 -1.4 Z"/></g>`;
// el monocromo (íconos con el tema del teléfono): la forma del sticker con la S calada
const mono = `<defs><mask id="m"><rect x="-60" y="-60" width="120" height="120" fill="#fff"/>${letra('#000')}<path d="${punta}" fill="#000"/></mask></defs>
  <g transform="translate(54 54) rotate(-9)"><path d="${forma}" fill="#fff" mask="url(#m)"/></g>`;

const svg = (dentro, vb = '0 0 108 108') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%">${dentro}</svg>`;
// el viejo (Android 7): el medio del adaptativo (72 de 108) con el fondo redondeado o en círculo
const viejo = (redondo) => `<defs><clipPath id="c">${redondo ? '<circle cx="54" cy="54" r="36"/>' : '<rect x="18" y="18" width="72" height="72" rx="16"/>'}</clipPath></defs><g clip-path="url(#c)">${fondo}${frente}</g>`;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
async function hacer(archivo, contenido, lado, vb) {
  await p.setViewportSize({ width: lado, height: lado });
  await p.setContent(`<!doctype html><style>@font-face{font-family:LG;src:url(${FUENTE})}html,body{margin:0;background:transparent}svg{display:block}</style>${svg(contenido, vb)}`);
  await p.evaluate(() => document.fonts.load('36px LG')); await p.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(archivo), { recursive: true }); await p.screenshot({ path: archivo, omitBackground: true });
}
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENS)) {
  const m = path.join(RES, 'mipmap-' + d);
  await hacer(path.join(m, 'ic_fondo.png'), fondo, 108 * k);
  await hacer(path.join(m, 'ic_frente.png'), frente, 108 * k);
  await hacer(path.join(m, 'ic_mono.png'), mono, 108 * k);
  await hacer(path.join(m, 'ic_launcher.png'), viejo(false), 48 * k, '18 18 72 72');
  await hacer(path.join(m, 'ic_launcher_round.png'), viejo(true), 48 * k, '18 18 72 72');
}
const adapt = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_fondo" />\n    <foreground android:drawable="@mipmap/ic_frente" />\n    <monochrome android:drawable="@mipmap/ic_mono" />\n</adaptive-icon>\n`;
fs.mkdirSync(path.join(RES, 'mipmap-anydpi-v26'), { recursive: true });
for (const n of ['ic_launcher', 'ic_launcher_round']) fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', n + '.xml'), adapt);
// Play Store: 512×512 cuadrado lleno (Play le redondea las puntas); el medio del adaptativo, un poco más grande
await hacer(path.join(MARCA, 'icono_512.png'), fondo + frente, 512, '16 16 76 76');
await b.close();
console.log('listo:', Object.keys(DENS).length * 5, 'PNG de Android + mipmap-anydpi-v26 + marca/icono_512.png');
