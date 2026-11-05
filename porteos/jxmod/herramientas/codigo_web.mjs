// La página con código (iPhone/iPad y cualquier navegador): el juego de web/index.html queda cifrado en juego.bin y sólo
// se abre con uno de los códigos de la lista. Sin un código bueno no hay juego que leer (no es un candado de pantalla):
//  - el código del juego (el gzip de #jsgz) va cifrado con una clave al azar (AES-GCM) en juego.bin;
//  - esa clave va guardada una vez por código, cifrada con lo que sale del código (PBKDF2-SHA256, 150 000 vueltas);
//  - la página pide el código, lo recuerda en ese aparato y la próxima vez abre sola (también sin internet);
//  - el paquete (pk.bin: modelos, texturas, sonidos) también va cifrado (AES-CTR, se descifra a medida que baja);
//  - sólo abre en su lugar (--lugar, la carpeta de la página en internet): lo que sale del código depende también de la
//    dirección, así que una copia de los archivos en otro lado (otra página, otra carpeta, el HTML bajado a la compu) no
//    abre ni con un código bueno.
// La lista de códigos queda FUERA del repo (por defecto /root/.jxmod/codigos.txt: «CÓDIGO  nombre» por línea, # para
// comentarios). Sacar un código de la lista y volver a armar = ese código deja de andar.
// uso: node herramientas/codigo_web.mjs CARPETA [--codigos ARCHIVO] [--nuevos N] [--mostrar] [--lugar URL_DE_LA_CARPETA ...]
//      (CARPETA: la de index.html recién armado con APP_WEB=1; después, herramientas/web_app.py)
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const args = process.argv.slice(2); const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const D = path.resolve(args[0] || '.'); const ARCH = opt('--codigos', '/root/.jxmod/codigos.txt');
const NUEVOS = +opt('--nuevos', 0) || 0; const MOSTRAR = args.includes('--mostrar');
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // (sin 0/O, 1/I/L: que no se confundan al tipearlos)
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const IT = 150000;
const LUGARES = args.flatMap((a, i) => (args[i - 1] === '--lugar' ? [a] : []));
if (!LUGARES.length) LUGARES.push('https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/');
for (const l of LUGARES) if (!/^https?:\/\/[^/]+\/(.*\/)?$/.test(l)) { console.error('--lugar tiene que ser la carpeta, con / al final: ' + l); process.exit(1); }

// 1. la lista de códigos (y los nuevos que se pidan)
let lineas = fs.existsSync(ARCH) ? fs.readFileSync(ARCH, 'utf8').split('\n') : ['# códigos de la página de JXMod: «CÓDIGO  nombre» (sacar una línea y volver a armar = ese código deja de andar)'];
for (let i = 0; i < NUEVOS; i++) {
  let c = ''; for (let j = 0; j < 8; j++) c += ABC[crypto.randomInt(ABC.length)];
  const n = lineas.filter((l) => l.trim() && !l.startsWith('#')).length + 1;
  lineas.push(c.slice(0, 4) + '-' + c.slice(4) + '  código ' + n);
}
if (NUEVOS) { fs.mkdirSync(path.dirname(ARCH), { recursive: true, mode: 0o700 }); fs.writeFileSync(ARCH, lineas.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 }); }
const codigos = lineas.filter((l) => l.trim() && !l.startsWith('#')).map((l) => { const [c, ...n] = l.trim().split(/\s+/); return { c, n: n.join(' ') }; });
if (!codigos.length) { console.error('no hay códigos en ' + ARCH + ' (usar --nuevos N)'); process.exit(1); }
for (const { c } of codigos) if (norm(c).length < 6) { console.error('código muy corto (mínimo 6 letras o números): ' + c); process.exit(1); }

// 2. el juego cifrado
const IDX = path.join(D, 'index.html'); let html = fs.readFileSync(IDX, 'utf8');
const A = '<script id="jsgz" type="text/plain">', i0 = html.indexOf(A), i1 = html.indexOf('</script>', i0);
if (i0 < 0) { console.error('index.html sin el juego en gzip (#jsgz): armarlo con APP_WEB=1'); process.exit(1); }
if (i1 === i0 + A.length) { console.error('index.html ya tiene código: volver a armar el juego primero'); process.exit(1); }
if (!html.includes('jxCodigoJuego')) { console.error('el arranque de index.html no sabe abrir el juego con código (armar.py viejo)'); process.exit(1); }
const gz = Buffer.from(html.slice(i0 + A.length, i1), 'base64');
const K = crypto.randomBytes(32), ivJ = crypto.randomBytes(12);
const cJ = crypto.createCipheriv('aes-256-gcm', K, ivJ); const bin = Buffer.concat([ivJ, cJ.update(gz), cJ.final(), cJ.getAuthTag()]);
fs.writeFileSync(path.join(D, 'juego.bin'), bin);
const V = crypto.createHash('sha256').update(bin).digest('hex').slice(0, 12);
// (el paquete, en su lugar: modo contador con una clave que sale de la del juego; se puede descifrar de a pedazos)
const PKB = path.join(D, 'pk.bin'); if (!fs.existsSync(PKB)) { console.error('falta pk.bin (armar con PK_BIN=1)'); process.exit(1); }
const Kp = crypto.createHash('sha256').update(K).update('jxmod-paquete').digest(), pn = crypto.randomBytes(8);
const cP = crypto.createCipheriv('aes-256-ctr', Kp, Buffer.concat([pn, Buffer.alloc(8)])); const pk = fs.readFileSync(PKB);
fs.writeFileSync(PKB, Buffer.concat([cP.update(pk), cP.final()]));

// 3. la clave del juego, una vez por código
const sal = crypto.randomBytes(16), C = {};
for (const { c } of codigos) for (const lugar of LUGARES) {
  const bits = crypto.pbkdf2Sync(norm(c) + '|' + lugar, sal, IT, 64, 'sha256');
  const id = crypto.createHash('sha256').update(bits.subarray(0, 32)).digest('hex').slice(0, 16);
  const iv = crypto.randomBytes(12), ci = crypto.createCipheriv('aes-256-gcm', bits.subarray(32), iv);
  C[id] = Buffer.concat([iv, ci.update(K), ci.final(), ci.getAuthTag()]).toString('base64');
}
const CL = { v: V, it: IT, sal: sal.toString('base64'), pn: pn.toString('base64'), c: C };

// 4. la página: el pedido del código (va antes del arranque del juego, que lo espera)
const PUERTA = `<script>
// ---------------- la página con código (la arma herramientas/codigo_web.mjs: no editar acá) ----------------
// El juego viene cifrado en juego.bin. El código abre su clave; se recuerda en este aparato y la próxima vez abre solo.
(function () {
  const CL = ${JSON.stringify(CL)};
  const L = (navigator.language || 'es').slice(0, 2), T = Object.assign({
    es: { tit: 'Ingresá tu código', bot: 'Jugar', mal: 'Ese código no es. Fijate las letras y probá de nuevo.', viejo: 'Tu código ya no sirve: pedí uno nuevo.', red: 'No se pudo bajar el juego. Revisá internet y probá de nuevo.', ayuda: 'Pedíselo a quien te pasó el link.', abr: 'Abriendo…' },
    en: { tit: 'Enter your code', bot: 'Play', mal: 'That code is not right. Check the letters and try again.', viejo: 'Your code no longer works: ask for a new one.', red: 'Could not download the game. Check your internet and try again.', ayuda: 'Ask whoever sent you the link.', abr: 'Opening…' },
    pt: { tit: 'Digite seu código', bot: 'Jogar', mal: 'Esse código não está certo. Confira as letras e tente de novo.', viejo: 'Seu código não vale mais: peça um novo.', red: 'Não deu para baixar o jogo. Confira a internet e tente de novo.', ayuda: 'Peça a quem te mandou o link.', abr: 'Abrindo…' }
  })[L] || { tit: 'Enter your code', bot: 'Play', mal: 'That code is not right. Check the letters and try again.', viejo: 'Your code no longer works: ask for a new one.', red: 'Could not download the game. Check your internet and try again.', ayuda: 'Ask whoever sent you the link.', abr: 'Opening…' };
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
  // (la carpeta donde está la página: con otra, lo que sale del código es otro y no abre nada)
  const LUGAR = location.origin + location.pathname.replace(/[^/]*$/, '');
  // (lo de cifrar lo hace el navegador —crypto.subtle— y, donde no está —una página sin https o un navegador viejo pueden no
  // tenerlo—, esto mismo en JS: SHA-256, PBKDF2 y AES-256 en modo contador como el de GCM)
  const S = (window.crypto && crypto.subtle && !window.__jxSinSubtle) ? crypto.subtle : null;
  const JS = (() => {
    const KK = new Int32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
    const IV = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Int32Array(64);
    function comp(h, m) {
      for (let i = 0; i < 16; i++) W[i] = m[i];
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15], b = W[i - 2];
        W[i] = (W[i - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + W[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) | 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (k + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + KK[i] + W[i]) | 0;
        const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
    }
    const pal = (u) => { const w = new Int32Array(Math.ceil(u.length / 4)); for (let i = 0; i < u.length; i++) w[i >> 2] |= u[i] << (24 - 8 * (i & 3)); return w; };
    const byt = (w, n) => { const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = w[i >> 2] >>> (24 - 8 * (i & 3)); return u; };
    function sha(u) {
      const n = u.length, L = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(L); m.set(u); m[n] = 0x80;
      const bits = n * 8; m[L - 4] = bits >>> 24; m[L - 3] = bits >>> 16; m[L - 2] = bits >>> 8; m[L - 1] = bits;
      const w = pal(m), h = IV.slice(); for (let i = 0; i < w.length; i += 16) comp(h, w.subarray(i, i + 16)); return byt(h, 32);
    }
    // (HMAC con los estados de adentro y de afuera ya calculados: cada vuelta de PBKDF2 son dos bloques de SHA-256)
    function pbkdf2(pass, sal, it, n) {
      const k = new Uint8Array(64); k.set(pass.length > 64 ? sha(pass) : pass);
      const adentro = IV.slice(), afuera = IV.slice(); comp(adentro, pal(k.map((x) => x ^ 0x36))); comp(afuera, pal(k.map((x) => x ^ 0x5c)));
      const blk = new Int32Array(16), u = new Int32Array(8), t = new Int32Array(8), out = new Uint8Array(32 * n);
      const hmac = (mw, ml) => {
        blk.fill(0); blk.set(mw); blk[ml >> 2] = 0x80000000 | 0; blk[15] = (64 + ml) * 8; u.set(adentro); comp(u, blk);
        blk.fill(0); blk.set(u); blk[8] = 0x80000000 | 0; blk[15] = 768; u.set(afuera); comp(u, blk);
      };
      for (let b = 1; b <= n; b++) {
        const m = new Uint8Array(sal.length + 4); m.set(sal); m[sal.length + 3] = b;
        hmac(pal(m), m.length); t.set(u);
        for (let j = 1; j < it; j++) { hmac(u.slice(), 32); for (let x = 0; x < 8; x++) t[x] ^= u[x]; }
        out.set(byt(t, 32), 32 * (b - 1));
      }
      return out;
    }
    // AES-256 (sólo cifrar: el modo contador descifra cifrando el contador) con las tablas de siempre
    const SB = new Uint8Array(256), T0 = new Int32Array(256), T1 = new Int32Array(256), T2 = new Int32Array(256), T3 = new Int32Array(256);
    { let p = 1, q = 1; const rl = (x, s) => ((x << s) | (x >>> (8 - s))) & 255;
      do { p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0)) & 255; q = (q ^ (q << 1)) & 255; q = (q ^ (q << 2)) & 255; q = (q ^ (q << 4)) & 255; if (q & 0x80) q ^= 0x09;
        SB[p] = q ^ rl(q, 1) ^ rl(q, 2) ^ rl(q, 3) ^ rl(q, 4) ^ 0x63; } while (p !== 1);
      SB[0] = 0x63;
      for (let x = 0; x < 256; x++) { const s = SB[x], s2 = ((s << 1) ^ (s & 0x80 ? 0x1b : 0)) & 255, s3 = s2 ^ s, t = (s2 << 24) | (s << 16) | (s << 8) | s3;
        T0[x] = t; T1[x] = (t >>> 8) | (t << 24); T2[x] = (t >>> 16) | (t << 16); T3[x] = (t >>> 24) | (t << 8); } }
    function expandir(k) {
      const w = new Int32Array(60), kw = pal(k); w.set(kw.subarray(0, 8)); let rc = 1;
      const sub = (t) => (SB[t >>> 24] << 24) | (SB[(t >>> 16) & 255] << 16) | (SB[(t >>> 8) & 255] << 8) | SB[t & 255];
      for (let i = 8; i < 60; i++) {
        let t = w[i - 1];
        if (i % 8 === 0) { t = sub((t << 8) | (t >>> 24)) ^ (rc << 24); rc = ((rc << 1) ^ (rc & 0x80 ? 0x1b : 0)) & 255; } else if (i % 8 === 4) t = sub(t);
        w[i] = w[i - 8] ^ t;
      }
      return w;
    }
    // modo contador: el bloque n se cifra con el contador [c0 c1 c2 n] (puede ser c = o, en su lugar)
    function ctrX(w, c0, c1, c2, n, c, o) {
      for (let off = 0; off < c.length; off += 16, n = (n + 1) | 0) {
        let s0 = c0 ^ w[0], s1 = c1 ^ w[1], s2 = c2 ^ w[2], s3 = n ^ w[3];
        for (let r = 4; r < 56; r += 4) {
          const t0 = T0[s0 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s3 & 255] ^ w[r];
          const t1 = T0[s1 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s0 & 255] ^ w[r + 1];
          const t2 = T0[s2 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s1 & 255] ^ w[r + 2];
          const t3 = T0[s3 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s2 & 255] ^ w[r + 3];
          s0 = t0; s1 = t1; s2 = t2; s3 = t3;
        }
        const f = [(SB[s0 >>> 24] << 24 | SB[(s1 >>> 16) & 255] << 16 | SB[(s2 >>> 8) & 255] << 8 | SB[s3 & 255]) ^ w[56],
          (SB[s1 >>> 24] << 24 | SB[(s2 >>> 16) & 255] << 16 | SB[(s3 >>> 8) & 255] << 8 | SB[s0 & 255]) ^ w[57],
          (SB[s2 >>> 24] << 24 | SB[(s3 >>> 16) & 255] << 16 | SB[(s0 >>> 8) & 255] << 8 | SB[s1 & 255]) ^ w[58],
          (SB[s3 >>> 24] << 24 | SB[(s0 >>> 16) & 255] << 16 | SB[(s1 >>> 8) & 255] << 8 | SB[s2 & 255]) ^ w[59]];
        const m = Math.min(16, c.length - off);
        for (let i = 0; i < m; i++) o[off + i] = c[off + i] ^ (f[i >> 2] >>> (24 - 8 * (i & 3)));
      }
      return o;
    }
    function ctr(k, d) {   // d: iv (12) + cifrado + etiqueta (16), como GCM; la etiqueta no se revisa (el código ya se verificó por su huella)
      const iv = pal(d.subarray(0, 12)), c = d.subarray(12, d.length - 16);
      return ctrX(expandir(k), iv[0], iv[1], iv[2], 2, c, new Uint8Array(c.length));
    }
    return { sha, pbkdf2, ctr, ctrX, expandir, pal };
  })();
  async function claveDe(cod) {
    const n = norm(cod); if (n.length < 6) return null;
    const pass = new TextEncoder().encode(n + '|' + LUGAR); let bits, id;
    if (S) {
      const base = await S.importKey('raw', pass, 'PBKDF2', false, ['deriveBits']);
      bits = new Uint8Array(await S.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(CL.sal), iterations: CL.it }, base, 512));
      id = hex(await S.digest('SHA-256', bits.slice(0, 32)));
    } else { bits = JS.pbkdf2(pass, b64(CL.sal), CL.it, 2); id = hex(JS.sha(bits.slice(0, 32))); }
    const e = CL.c[id.slice(0, 16)]; if (!e) return null;
    const w = b64(e);
    if (!S) return JS.ctr(bits.slice(32), w);
    const kw = await S.importKey('raw', bits.slice(32), 'AES-GCM', false, ['decrypt']);
    try { return new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: w.slice(0, 12) }, kw, w.slice(12))); } catch (x) { return null; }
  }
  // el paquete (pk.bin) se descifra en su lugar a medida que llega (juego/datos.js llama una vez por pedazo)
  async function paquete(k) {
    const m = new Uint8Array(k.length + 13); m.set(k); m.set(new TextEncoder().encode('jxmod-paquete'), k.length);
    const kp = S ? await S.importKey('raw', await S.digest('SHA-256', m), 'AES-CTR', false, ['decrypt']) : null, pn = b64(CL.pn);
    const w = S ? null : JS.expandir(JS.sha(m)), pw = JS.pal(pn); let hecho = 0;
    return async (u8, o, fin) => {
      const hasta = fin ? o : o - (o % 16); if (hasta <= hecho) return hecho;
      const parte = u8.subarray(hecho, hasta), n = hecho / 16;
      if (S) {
        const ctr = new Uint8Array(16); ctr.set(pn); ctr[12] = n >>> 24; ctr[13] = n >>> 16; ctr[14] = n >>> 8; ctr[15] = n;
        u8.set(new Uint8Array(await S.decrypt({ name: 'AES-CTR', counter: ctr, length: 64 }, kp, parte)), hecho);
      } else JS.ctrX(w, pw[0], pw[1], 0, n, parte, parte);
      hecho = hasta; return hecho;
    };
  }
  async function abrir(k) {
    const r = await fetch('juego.bin?v=' + CL.v); if (!r.ok) throw new Error('red');
    const d = new Uint8Array(await r.arrayBuffer()); let g;
    if (!S) g = JS.ctr(k, d);
    else { const kj = await S.importKey('raw', k, 'AES-GCM', false, ['decrypt']); g = new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: d.slice(0, 12) }, kj, d.slice(12))); }
    window.jxCodigoPaq = await paquete(k);
    return g;
  }
  const leer = () => { try { return localStorage.getItem('jx_codigo') || ''; } catch (e) { return ''; } };
  const anotar = (c) => { try { if (c) localStorage.setItem('jx_codigo', c); else localStorage.removeItem('jx_codigo'); } catch (e) {} };
  function puerta(aviso) {
    return new Promise((listo) => {
      const st = document.createElement('style');
      st.textContent = '#jxPuerta{position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:center;align-items:flex-start;padding:max(14px,env(safe-area-inset-top)) 16px 16px;background:rgba(7,8,11,.9);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font:15px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f2f2f2;touch-action:manipulation;overflow:auto}'
        + '#jxPuerta .c{width:min(100%,420px);margin-top:min(14vh,90px);background:#171a21;border:1px solid rgba(255,206,110,.38);border-radius:18px;padding:16px 16px 14px;box-shadow:0 10px 40px rgba(0,0,0,.55)}'
        + '#jxPuerta .t{display:flex;align-items:center;gap:12px;font-weight:700;font-size:19px;margin-bottom:12px}#jxPuerta .t img{width:44px;height:44px;border-radius:11px}'
        + '#jxPuerta .f{display:flex;gap:8px}#jxPuerta input{flex:1;min-width:0;height:48px;border-radius:12px;border:1px solid #3a4150;background:#0d0f14;color:#fff;font:600 20px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;padding:0 12px;outline:none;-webkit-user-select:text;user-select:text}'
        + '#jxPuerta input:focus{border-color:#ffce6e}#jxPuerta button{height:48px;padding:0 20px;border:0;border-radius:12px;background:#2f7cf6;color:#fff;font:700 17px system-ui,-apple-system,sans-serif}#jxPuerta button:disabled{opacity:.6}'
        + '#jxPuerta .m{min-height:20px;margin-top:9px;color:#ff8a80;font-size:14px}#jxPuerta .m.ok{color:#9fd3ff}#jxPuerta .a{color:#9aa3b2;font-size:13px}'
        + '@media (max-height:500px){#jxPuerta .c{margin-top:0}}';
      const d = document.createElement('div'); d.id = 'jxPuerta';
      d.innerHTML = '<form class="c" autocomplete="off"><div class="t"><img src="app/icono-180.png" alt=""><span></span></div><div class="f"><input name="codigo" maxlength="24" placeholder="XXXX-XXXX" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label=""><button type="submit"></button></div><div class="m"></div><div class="a"></div></form>';
      const f = d.querySelector('form'), inp = f.querySelector('input'), bot = f.querySelector('button'), m = f.querySelector('.m');
      f.querySelector('.t span').textContent = T.tit; inp.setAttribute('aria-label', T.tit); bot.textContent = T.bot; f.querySelector('.a').textContent = T.ayuda; m.textContent = aviso || '';
      // (el juego no deja tocar ni escribir fuera de lo suyo: la puerta frena esos eventos para que el campo ande)
      for (const ev of ['pointerdown', 'touchstart', 'keydown', 'keyup', 'mousedown']) d.addEventListener(ev, (e) => e.stopPropagation());
      f.onsubmit = async (e) => {
        e.preventDefault(); if (bot.disabled) return;
        bot.disabled = true; m.className = 'm ok'; m.textContent = T.abr;
        let k = null; try { k = await claveDe(inp.value); } catch (x) { k = null; }
        if (!k) { bot.disabled = false; m.className = 'm'; m.textContent = T.mal; inp.select(); return; }
        try { const g = await abrir(k); anotar(norm(inp.value)); st.remove(); d.remove(); listo(g); }
        catch (x) { bot.disabled = false; m.className = 'm'; m.textContent = T.red; }
      };
      document.head.appendChild(st); document.body.appendChild(d);
      setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
    });
  }
  window.jxCodigoJuego = async () => {
    const g = leer(); let aviso = '';
    if (g) {
      const k = await claveDe(g).catch(() => null);
      if (k) { try { return await abrir(k); } catch (e) { aviso = T.red; } }
      else { anotar(''); aviso = T.viejo; }
    }
    return puerta(aviso);
  };
})();
</script>
`;
html = html.slice(0, i0) + PUERTA + A + html.slice(i1);
fs.writeFileSync(IDX, html);
console.log('ok', codigos.length, 'códigos ·', LUGARES.length === 1 ? 'en ' + LUGARES[0] : LUGARES.length + ' lugares', '· pk.bin cifrado', (pk.length / 1048576).toFixed(1), 'MB · juego.bin', (bin.length / 1048576).toFixed(2), 'MB · index.html', (Buffer.byteLength(html) / 1048576).toFixed(2), 'MB · versión', V);
if (MOSTRAR) for (const { c, n } of codigos) console.log('  ' + c + (n ? '  (' + n + ')' : ''));
