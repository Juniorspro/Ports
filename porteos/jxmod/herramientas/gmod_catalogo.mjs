// Catálogo del Workshop de Garry's Mod para la tienda del juego, para que ande sin ningún puente: Steam no deja que una
// página le pida la búsqueda ni los detalles, pero sí deja bajar los .gma de su servidor de archivos (cdn.steamusercontent.com
// manda Access-Control-Allow-Origin: *). Acá se recorre el Workshop (los más suscriptos de cada categoría) y se guardan los
// addons que Steam da directo: nombre, foto, tamaño, suscriptos, etiquetas, una descripción corta y la dirección del archivo.
// Sale un paquete chico (gzip) en web/rb/ y el nombre queda anotado en juego/gmod_tienda.js.
// uso: node herramientas/gmod_catalogo.mjs [páginas por categoría = 50] [páginas sin categoría = 150]
import fs from 'fs'; import zlib from 'zlib'; import crypto from 'crypto'; import path from 'path';
const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.join(AQUI, '..');
const PAGS = +process.argv[2] || 50, PAGS0 = +process.argv[3] || 150;
const TAGS = ['', 'Weapon', 'Entity', 'NPC', 'Vehicle', 'Tool', 'Model', 'Effects', 'Fun', 'Roleplay', 'Realism', 'Cartoon', 'Scenic', 'Build', 'Comic', 'Water', 'Movie'];
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0', 'Accept-Language': 'en-US,en;q=0.8' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function pedir(u, opt, n = 4) { for (let k = 0; k < n; k++) { try { const r = await fetch(u, opt); if (r.ok) return r; if (r.status === 429) await espera(5000 * (k + 1)); } catch (e) { await espera(1500); } } throw new Error('no anda ' + u.slice(0, 90)); }
const idsDePagina = (h) => [...new Set([...h.matchAll(/publishedfileid\\?"\s*[:=]\s*\\?"(\d{3,12})/g)].map((x) => x[1]))];
const ids = new Set();
for (const tag of TAGS) {
  const antes = ids.size;
  for (let p = 1; p <= (tag ? PAGS : PAGS0); p++) {
    let u = `https://steamcommunity.com/workshop/browse/?appid=4000&section=readytouseitems&browsesort=totaluniquesubscribers&actualsort=totaluniquesubscribers&p=${p}&numperpage=30&requiredtags%5B%5D=Addon`;
    if (tag) u += '&requiredtags%5B%5D=' + tag;
    const L = idsDePagina(await (await pedir(u, { headers: UA })).text()).slice(0, 30);
    L.forEach((x) => ids.add(x));
    if (!L.length) break;
    await espera(350);
  }
  process.stderr.write(`${tag || 'todos'}: +${ids.size - antes} (${ids.size})\n`);
}
// detalles de a 100
const items = [], todos = [...ids];
for (let i = 0; i < todos.length; i += 100) {
  const ch = todos.slice(i, i + 100), body = 'itemcount=' + ch.length + ch.map((x, k) => `&publishedfileids[${k}]=${x}`).join('');
  const d = await (await pedir('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })).json();
  for (const x of (d.response && d.response.publishedfiledetails) || []) if (x.result === 1 && x.consumer_app_id === 4000 && !x.banned && x.file_url) items.push(x);
  await espera(200);
}
// compacto: las direcciones sin su comienzo fijo, las etiquetas como números
const TAB = [], tagN = (t) => { let i = TAB.indexOf(t); if (i < 0) { i = TAB.length; TAB.push(t); } return i; };
const corta = (u, pre) => (u && u.startsWith(pre) ? u.slice(pre.length) : u || '');
const limpia = (s, n) => String(s || '').replace(/\[[^\]]{0,40}\]/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
items.sort((a, b) => (b.subscriptions | 0) - (a.subscriptions | 0));
const L = items.map((x) => [String(x.publishedfileid), limpia(x.title, 80), corta(x.preview_url, 'https://images.steamusercontent.com/ugc/'), corta(x.file_url, 'https://cdn.steamusercontent.com/ugc/'),
  Math.round((+x.file_size || 0) / 1e5), x.subscriptions | 0, x.favorited | 0, (x.tags || []).map((t) => tagN(String(t.tag).slice(0, 24))), Math.round((x.time_updated | 0) / 86400), limpia(x.description, 160)]);
const datos = { v: 1, fecha: Math.round(Date.now() / 1000), img: 'https://images.steamusercontent.com/ugc/', cdn: 'https://cdn.steamusercontent.com/ugc/', tags: TAB, l: L };
const gz = zlib.gzipSync(Buffer.from(JSON.stringify(datos)), { level: 9 });
const h = crypto.createHash('sha1').update(gz).digest('hex').slice(0, 10), nom = `gm_cat.${h}.bin`, dir = path.join(RAIZ, '../../web/rb');
for (const f of fs.readdirSync(dir)) if (/^gm_cat\.[0-9a-f]+\.bin$/.test(f) && f !== nom) fs.unlinkSync(path.join(dir, f));
fs.writeFileSync(path.join(dir, nom), gz);
const js = path.join(RAIZ, 'juego/gmod_tienda.js'); let s = fs.readFileSync(js, 'utf8');
s = s.replace(/const GM_CAT = '[^']*';/, `const GM_CAT = '${nom}';`); fs.writeFileSync(js, s);
console.log(`${items.length} addons con descarga directa (de ${ids.size} vistos) · ${(gz.length / 1024).toFixed(0)} KB · ${nom}`);
