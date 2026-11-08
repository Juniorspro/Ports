// las UV de las texturas en highp (gl.js: FS y FS_DEPTH; a100 las baja a mediump en un WebGL 1 sin highp en el fragment
// shader) y gbspUVcorr (las caras con la textura muy repetida, corridas por el entero de su centro). En la compu mediump ya
// es de 32 bits, así que se prueba:
//  A) que todos los shaders compilan y enlazan con un mapa BSP cargado: WebGL 2 en las 5 calidades (LUZ 0, 1, 2 y 3) y
//     WebGL 1 (?gl=1) en una baja y una alta; sin errores de JS, sin «shader simplificado» y el mapa se dibuja. Y la rama
//     de WebGL 1 sin highp: el FS que sale de a100 con JX_HP = mediump (y además todo en mediump, como un Mali-400),
//     compilado y enlazado a mano en un contexto webgl1.
//  C) cómo se veía en el celu: con la UV redondeada a medio float (16 bits, lo que hacía mediump) contra la de ahora
//     (highp), en calidad Bajo (LUZ 1, mediump), con las texturas hasta 512 y la cámara fija mirando el piso.
//     La emulación se mete sólo en la prueba (en el texto del shader, antes de compilar); los archivos del juego no cambian.
// uso: node uv_mediump.mjs URL_HTML URL_BSP [CARPETA_FOTOS] [CAM: "x,y,z,yaw,pitch" en metros del juego / radianes]
//   (URL_HTML con http://, p. ej. un python3 -m http.server en la carpeta del HTML y de rb/; ANTES_HTML=otro.html usa ese
//   armado —p. ej. el de antes del arreglo— para la foto «antes»; SOLO=A o SOLO=C hace una parte)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, BSP, DIR = '.', CAMS] = process.argv, D = DIR.replace(/\/?$/, '/');
fs.mkdirSync(D, { recursive: true });   // (la carpeta de las fotos, si no está)
const MAPA = BSP.split('/').pop().replace(/\.bsp$/i, ''), SOLO = process.env.SOLO || '';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const url = (h, gl) => h + (h.includes('?') ? '&' : '?') + 'test&gl=' + gl;

// el gancho: cada shader compilado y cada programa enlazado se revisan (COMPILE_STATUS / LINK_STATUS); se guardan los FS
// principales (los que leen la luz horneada) con su VS, y con window.__f16 la UV del FS principal se redondea a medio float
const GANCHO = () => {
  const S = window.__sh = { vs: 0, fs: 0, link: 0, errC: [], errL: [], fsHighpUV: 0, fsSinHighpUV: 0, f16: 0, pares: [] };
  const F16 = 'highp vec2 f16(highp vec2 x){ highp vec2 e = floor(log2(max(abs(x), vec2(6.104e-5)))); highp vec2 s = exp2(e - 10.0); return floor(x / s + 0.5) * s; }';
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue; const P = C.prototype, ss = P.shaderSource, cs = P.compileShader, lp = P.linkProgram;
    P.shaderSource = function (s, src) {
      const prin = /uniform sampler2D uLM/.test(src) && /\bvU\b/.test(src);
      if (prin) { if (/(in|varying)\s+(highp|JX_HP)\s+vec2\s+vU;/.test(src)) S.fsHighpUV++; else S.fsSinHighpUV++; }
      if (prin && window.__f16) {
        // (la entrada sigue llamándose vU —tiene que coincidir con la salida del VS—; lo que viene después la usa redondeada)
        const m = /\b(?:in|varying)\s+(?:highp |JX_HP )?vec2\s+vU;/.exec(src);
        if (m) { const i = m.index + m[0].length; src = src.slice(0, i) + '\n' + F16 + '\n' + src.slice(i).replace(/\bvU\b/g, 'f16(vU)'); S.f16++; }
      }
      s.__src = src; return ss.call(this, s, src);
    };
    P.compileShader = function (s) {
      cs.call(this, s); const fsh = this.getShaderParameter(s, this.SHADER_TYPE) === this.FRAGMENT_SHADER; fsh ? S.fs++ : S.vs++;
      if (!this.getShaderParameter(s, this.COMPILE_STATUS)) S.errC.push((fsh ? 'FS: ' : 'VS: ') + String(this.getShaderInfoLog(s)).slice(0, 400));
    };
    P.linkProgram = function (p) {
      lp.call(this, p); S.link++;
      if (!this.getProgramParameter(p, this.LINK_STATUS)) S.errL.push(String(this.getProgramInfoLog(p)).slice(0, 400));
      const sh = this.getAttachedShaders(p) || [], vs = sh.find((x) => this.getShaderParameter(x, this.SHADER_TYPE) === this.VERTEX_SHADER), f = sh.find((x) => x !== vs);
      if (f && f.__src && /uniform sampler2D uLM/.test(f.__src) && S.pares.length < 40 && !S.pares.some((q) => q.fs === f.__src)) S.pares.push({ vs: vs && vs.__src, fs: f.__src });
    };
  }
};

// porcentaje de píxeles no negros de una captura, y la diferencia entre dos (en la página: sin bibliotecas aparte)
const MEDIR = async ([a, b, caja]) => {
  const px = async (s) => { const im = await createImageBitmap(new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], { type: 'image/png' })); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height); };
  const A = await px(a); let nn = 0; for (let i = 0; i < A.data.length; i += 4) if (A.data[i] + A.data[i + 1] + A.data[i + 2] > 24) nn++;
  const r = { w: A.width, h: A.height, noNegro: +(100 * nn / (A.width * A.height)).toFixed(1) };
  if (b) {
    const B = await px(b), [x0, y0, x1, y1] = caja || [0, 0, A.width, A.height]; let s = 0, n8 = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * A.width + x) * 4; let m = 0; for (let k = 0; k < 3; k++) { const d = Math.abs(A.data[i + k] - B.data[i + k]); s += d; if (d > m) m = d; } if (m > 8) n8++; n++; }
    r.difMedia = +(s / (n * 3)).toFixed(2); r.dif8 = +(100 * n8 / n).toFixed(2);
  }
  return r;
};
async function medir(p, a, b, caja) { return p.evaluate(MEDIR, [a.toString('base64'), b ? b.toString('base64') : null, caja || null]); }

// abre el juego con un motor y una calidad, arma el mapa BSP, pone la cámara y saca la foto
async function partida(html, gl, gfx, { f16 = false, tex512 = false } = {}) {
  const prefs = { bienvenida: true, gfx, res: 100, resDin: false, ocultarUI: true, fps: false, motor: gl === 1 ? 'webgl1' : 'webgl2', motorV: 2, sombras: 'auto', post: 'auto', texQ: 'auto' };
  const { b, p, err, ev } = await abrir(url(html, gl), false, null, async (pg) => {
    await pg.addInitScript((pr) => { try { localStorage.setItem('jx_prefs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('jx_prefs') || '{}'), pr))); } catch (e) {} }, prefs);
    await pg.addInitScript((v) => { window.__f16 = v; }, f16);
    await pg.addInitScript(GANCHO);
  });
  // (las texturas de GMod hasta 512 —el tope de los celus con poca memoria—, en vez de las 128/256 de Patata y Bajo)
  if (tex512) await ev(`for (const k of ['patata', 'bajo', 'medio']) PERFILES[k].texMax = 512; 1`);
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(gfx)}; aplicarGfx(); inicioMostrar(false); 1`);
  const k = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(BSP)})).arrayBuffer()); const r = 'maps/${MAPA}.bsp';
    GMOD.arch.set(r, b); const k = gbspClave(r); GBSP.mapas.set(k, { id: 'uvprueba', ruta: r, nombre: '${MAPA}', addon: 'uvprueba' }); if (!MAPAS_RB.includes(k)) MAPAS_RB.push(k); empezarPartida(k); return k; })()`);
  const t0 = Date.now();
  await p.waitForFunction((m) => window.__ev(`MUNDO.nombre === ${JSON.stringify(m)} && JUEGO.estado === 'juego'`), k, { timeout: 300000, polling: 500 }).catch(() => {});
  const seg = +((Date.now() - t0) / 1000).toFixed(1);
  await p.waitForTimeout(4000);
  // (el jugador, en la primera aparición: jugadorAparecer elige una al azar y cada partida quedaba distinta)
  await ev(`(() => { const s = MUNDO.spawns[0]; if (s) { JUG.pos.set(s.x, s.y + 1.2, s.z); JUG.vel.set(0, 0, 0); if (s.yaw !== undefined) JUG.yaw = s.yaw; } return 1; })()`);
  await p.waitForTimeout(1000);
  // la cámara: la dada, o desde la primera aparición (a la altura de los ojos) mirando el piso para adelante
  const cam = CAMS ? CAMS.split(',').map(Number) : null;
  await ev(cam ? `DBG.cam = { p: v3(${cam[0]}, ${cam[1]}, ${cam[2]}), q: Quat.euler(${cam[3]}, ${cam[4]}) }; 1`
    : `(() => { const s = MUNDO.spawns[0] || JUG.pos; DBG.cam = { p: v3(s.x, s.y + 1.7, s.z), q: Quat.euler(s.yaw || 0, 0.45) }; return 1; })()`);
  // (hasta que no queden shaders compilando en paralelo ni texturas llegando: dos fotos seguidas iguales)
  let foto = null, f0 = null;
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(1500); foto = await p.screenshot(); if (f0 && (await medir(p, foto, f0)).dif8 < 0.05) break; f0 = foto; }
  const info = await ev(`({ mapa: MUNDO.nombre, estado: JUEGO.estado, gl1: !!R.gl1, luz: GFX.luz, salida: R.salida, texMax: GFX.texMax, tris: MUNDO.nt, errShader: R.errShader || null, progs: R.progs.size, cam: [CAM.pos.x, CAM.pos.y, CAM.pos.z].map((x) => +x.toFixed(2)), jug: [JUG.pos.x, JUG.pos.y, JUG.pos.z, JUG.yaw || 0].map((x) => +x.toFixed(2)) })`);
  const sh = await p.evaluate(() => { const S = window.__sh; return { vs: S.vs, fs: S.fs, link: S.link, errC: S.errC.slice(0, 5), errL: S.errL.slice(0, 5), fsHighpUV: S.fsHighpUV, fsSinHighpUV: S.fsSinHighpUV, f16: S.f16, pares: S.pares.length }; });
  const m = await medir(p, foto);
  const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
  return { b, p, ev, seg, info, sh, m, err: e2, foto };
}

if (SOLO !== 'C') {
  // A) compilación: WebGL 2 en las 5 calidades, WebGL 1 en una baja y una alta
  const filas = [];
  // (A_CONF="1:bajo,2:ultra": sólo ésas)
  const CONF = process.env.A_CONF ? process.env.A_CONF.split(',').map((x) => [+x.split(':')[0], x.split(':')[1]]) : [[2, 'patata'], [2, 'bajo'], [2, 'medio'], [2, 'alto'], [2, 'ultra'], [1, 'patata'], [1, 'bajo'], [1, 'alto']];
  for (const [gl, gfx] of CONF) {
    const r = await partida(HTML, gl, gfx);
    const sinErr = !r.sh.errC.length && !r.sh.errL.length && !r.info.errShader && !r.err.some((x) => /shader simplificado/.test(x));
    const fila = { gl: 'WebGL' + gl + (r.info.gl1 ? '(1)' : '(2)'), gfx, luz: r.info.luz, armado: r.seg + ' s', shaders: r.sh.vs + ' VS + ' + r.sh.fs + ' FS, ' + r.sh.link + ' programas', errCompilar: r.sh.errC, errEnlazar: r.sh.errL, errShader: r.info.errShader, errJS: r.err.slice(0, 4), fsPrincipalHighp: r.sh.fsHighpUV + '/' + (r.sh.fsHighpUV + r.sh.fsSinHighpUV), noNegro: r.m.noNegro + ' %' };
    filas.push(fila);
    ok(`A ${fila.gl} ${gfx} (LUZ ${r.info.luz}): ${MAPA} armado, shaders compilan y enlazan, sin errores de JS, se dibuja`, r.info.mapa === 'WS_' + MAPA.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40) && r.info.gl1 === (gl === 1) && sinErr && !r.err.length && r.sh.fsHighpUV > 0 && r.sh.fsSinHighpUV === 0 && r.m.noNegro > 0, fila);
    if (DIR !== '.') fs.writeFileSync(D + `uv_A_gl${gl}_${gfx}_${MAPA}.png`, r.foto);
    // la rama sin highp de WebGL 1: los FS principales que armó a100 (los de esta partida), con JX_HP = mediump y además
    // con todo en mediump (un aparato sin GL_FRAGMENT_PRECISION_HIGH), compilados y enlazados a mano
    if (gl === 1) {
      const res = await r.p.evaluate(() => {
        const g = document.createElement('canvas').getContext('webgl'), out = { fs: 0, soloJX: 0, todoMed: 0, err: [] };
        g.getExtension('OES_standard_derivatives');
        const comp = (t, src) => { const s = g.createShader(t); g.shaderSource(s, src); g.compileShader(s); return [s, g.getShaderParameter(s, g.COMPILE_STATUS), g.getShaderInfoLog(s)]; };
        // (copia: los programas que se enlazan acá también pasan por el gancho y se sumarían a la lista)
        for (const q of window.__sh.pares.slice()) {
          if (!/#define JX_HP highp/.test(q.fs)) { out.err.push('el FS no tiene el bloque de JX_HP'); continue; }
          out.fs++;
          const v1 = q.fs.replace(/#ifdef GL_FRAGMENT_PRECISION_HIGH\n#define JX_HP highp\n#else\n#define JX_HP mediump\n#endif\n/, '#define JX_HP mediump\n');
          const v2 = v1.replace(/#ifdef GL_FRAGMENT_PRECISION_HIGH\n([^#]*)#else\n([^#]*)#endif\n/g, '$2');
          for (const [nom, src] of [['soloJX', v1], ['todoMed', v2]]) {
            const [sf, okf, logf] = comp(g.FRAGMENT_SHADER, src); let okl = false, logl = '';
            if (okf && q.vs) { const [sv] = comp(g.VERTEX_SHADER, q.vs), pr = g.createProgram(); g.attachShader(pr, sv); g.attachShader(pr, sf); g.linkProgram(pr); okl = g.getProgramParameter(pr, g.LINK_STATUS); logl = g.getProgramInfoLog(pr); }
            if (okf && okl) out[nom]++; else out.err.push(nom + ': ' + String(logf || logl).slice(0, 300));
          }
          if (out.fs === 1) out.ejemplo = v1.split('\n').filter((l) => /JX_HP|precision/.test(l)).slice(0, 6);
          // (lo que queda en highp en el FS de «todo en mediump»: un aparato sin highp en el fragment shader no lo compilaría)
          for (const l of v2.split('\n')) if (/\bhighp\b/.test(l)) (out.highpSueltos = out.highpSueltos || new Set()).add(l.trim().slice(0, 120));
        }
        if (out.highpSueltos) out.highpSueltos = [...out.highpSueltos].slice(0, 6);
        return out;
      });
      ok(`A WebGL1 ${gfx}: el FS de a100 con JX_HP = mediump (y todo en mediump) compila y enlaza a mano`, res.fs > 0 && res.soloJX === res.fs && res.todoMed === res.fs && !res.err.length, res);
    }
    await r.b.close();
  }
  console.log('TABLA A'); console.table(filas.map((f) => ({ motor: f.gl, calidad: f.gfx, LUZ: f.luz, shaders: f.shaders, errores: f.errCompilar.length + f.errEnlazar.length + (f.errShader ? 1 : 0), errJS: f.errJS.length, 'FS uv highp': f.fsPrincipalHighp, 'no negro': f.noNegro })));
}

if (SOLO !== 'A') {
  // C) celu antes (UV en medio float) / después (highp), WebGL 2, Bajo (LUZ 1: el FS en mediump), texturas hasta 512
  const fotos = {};
  for (const [nom, html, f16] of [['antes', process.env.ANTES_HTML || HTML, true], ['despues', HTML, false]]) {
    const r = await partida(html, 2, 'bajo', { f16, tex512: true });
    ok(`C ${nom}: ${MAPA} en Bajo (LUZ ${r.info.luz}), emulación de medio float ${f16 ? 'puesta' : 'apagada'}`, r.info.luz === 1 && (f16 ? r.sh.f16 > 0 : r.sh.f16 === 0) && !r.sh.errC.length && !r.sh.errL.length && !r.info.errShader && r.m.noNegro > 0, { ...r.info, f16: r.sh.f16, noNegro: r.m.noNegro, errC: r.sh.errC });
    fotos[nom] = r.foto; fs.writeFileSync(D + `celu_${nom}_${MAPA}.png`, r.foto);
    if (nom === 'despues') {
      const d = await medir(r.p, fotos.antes, fotos.despues), dAbajo = await medir(r.p, fotos.antes, fotos.despues, [0, 360, r.m.w, r.m.h]);
      ok(`C antes/después: la diferencia se ve (promedio > 1 o más del 2 % de los píxeles con diferencia > 8)`, d.difMedia > 1 || d.dif8 > 2, { todo: d, mitadDeAbajo: dAbajo });
      // la hoja lado a lado, con los rótulos
      const hoja = await r.p.evaluate(async ([a, b, t, ta]) => {
        const im = async (s) => createImageBitmap(new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], { type: 'image/png' }));
        const A = await im(a), B = await im(b), W = A.width, H = A.height, c = new OffscreenCanvas(W * 2 + 12, H + 56), x = c.getContext('2d');
        x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height); x.drawImage(A, 0, 56); x.drawImage(B, W + 12, 56);
        x.font = 'bold 30px sans-serif'; x.fillStyle = '#ff6b5a'; x.fillText(ta, 14, 38); x.fillStyle = '#6bd66b'; x.fillText('DESPUÉS (UV en highp)', W + 26, 38);
        x.font = '18px sans-serif'; x.fillStyle = '#ccc'; x.fillText(t, W * 2 - 520, 34);
        const bl = await c.convertToBlob({ type: 'image/png' }), u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s);
      }, [fotos.antes.toString('base64'), fotos.despues.toString('base64'), MAPA + ' · WebGL 2 · Bajo · texturas ≤ 512', process.env.ANTES_HTML ? 'ANTES (armado de antes, UV en mediump)' : 'ANTES (UV en mediump, 16 bits)']);
      fs.writeFileSync(D + 'tx1_comparacion.png', Buffer.from(hoja, 'base64'));
      console.log('fotos:', D + `celu_antes_${MAPA}.png`, D + `celu_despues_${MAPA}.png`, D + 'tx1_comparacion.png');
    }
    await r.b.close();
  }
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(R.every(Boolean) ? 0 : 1);
