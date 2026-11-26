// Baja addons del Workshop de Garry's Mod por el mismo camino que el juego web (juego/gmod_pipe.js): la tienda de JXMod (el
// worker) entra anónima a Steam y da la clave del depósito y el código del manifiesto; acá se baja el manifiesto y los
// pedazos del CDN de Steam a través de la tienda, se descifran, se descomprimen y se arma el .gma. Sirve para los addons que
// Steam no da como archivo directo (SteamPipe: casi todos los mapas nuevos). Usa el código del juego tal cual (no lo copia):
// carga juego/gmod_formatos.js (el LZMA) y juego/gmod_pipe.js en un contexto aparte con lo poco del navegador que piden.
// Uso: NODE_USE_ENV_PROXY=1 node herramientas/workshop_bajar.mjs ID [ID...] --salida CARPETA
// Sale CARPETA/ID.gma de cada uno. Los archivos extraídos de otros autores no van al repo (ver CLAUDE.md y CREDITOS.md).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const JUEGO = path.join(AQUI, '..', 'juego');
const TIENDA_URL = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/';

const args = process.argv.slice(2); const i = args.indexOf('--salida');
const salida = i >= 0 ? args[i + 1] : '.'; const ids = args.filter((a, k) => /^\d{3,12}$/.test(a) && k !== i + 1);
if (!ids.length) { console.error('uso: workshop_bajar.mjs ID [ID...] --salida CARPETA'); process.exit(1); }
fs.mkdirSync(salida, { recursive: true });

// (lo del navegador que usa gmod_pipe.js: fetch con tiempo, Blob, WebCrypto; sin Worker la descompresión va en este hilo)
const ctx = {
  console, setTimeout, clearTimeout, TextDecoder, TextEncoder, Blob, AbortController, fetch, Response, DecompressionStream, crypto: webcrypto, TIENDA_URL,
  T: (k) => k, Uint8Array, Uint16Array, Uint32Array, Int16Array, Int32Array, ArrayBuffer, DataView, Math, Map, Set, Promise, Error, Object, Array, String, Number, JSON,
};
ctx.gmTiempo = (p, ms, msg) => { let t = 0; const tope = new Promise((_, mal) => { t = setTimeout(() => mal(Object.assign(new Error(msg || 'tardó demasiado'), { trabado: true })), ms); }); return Promise.race([p, tope]).finally(() => clearTimeout(t)); };
ctx.gmFetch = async (url, opt, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 25000); try { return await fetch(url, Object.assign({}, opt || {}, { signal: c.signal })); } finally { clearTimeout(t); } };
vm.createContext(ctx);
for (const f of ['inflar.js', 'gmod_formatos.js', 'gmod_pipe.js']) vm.runInContext(fs.readFileSync(path.join(JUEGO, f), 'utf8') + '\n;globalThis.GMF = typeof GMF !== "undefined" ? GMF : globalThis.GMF; globalThis.gpBajar = typeof gpBajar !== "undefined" ? gpBajar : globalThis.gpBajar;', ctx, { filename: f });

for (const id of ids) {
  const t0 = Date.now(); let ult = -1;
  process.stdout.write(`${id}: `);
  try {
    const r = await ctx.gpBajar(id, (p) => { const k = Math.floor(p * 20); if (k !== ult) { ult = k; process.stdout.write('.'); } });
    const b = r instanceof Uint8Array ? r : new Uint8Array(await r.arrayBuffer());
    const ruta = path.join(salida, id + '.gma'); fs.writeFileSync(ruta, b);
    console.log(` ${(b.length / 1e6).toFixed(1)} MB en ${((Date.now() - t0) / 1000).toFixed(0)} s → ${ruta}${String.fromCharCode(...b.subarray(0, 4)) === 'GMAD' ? '' : ' (¡no empieza con GMAD!)'}`);
  } catch (e) { console.log(` error: ${e && e.message || e}`); }
}
