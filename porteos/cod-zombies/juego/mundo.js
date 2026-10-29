// Hilo del emulador (Worker): carga la imagen del juego y sus datos, corre el guest por tramos y habla con la pagina.
//   pagina -> worker: {t:'init', base, paq, canvas, ancho, alto, ...}  {t:'ptr', e, id, x, y}  {t:'visible', v}
//   worker -> pagina: {t:'estado', texto}  {t:'listo'}  {t:'fps', ...}  {t:'error', texto}
'use strict';
const _w = typeof importScripts === 'function';
if (_w && typeof Cpu === 'undefined') importScripts('decode.js', 'cpu.js', 'vfp.js', 'icf.js', 's3e.js', 'fsvirtual.js', 'gl.js', 'graficos.js', 'dxt.js');

const Mundo = {
  est: (texto) => postMessage({ t: 'estado', texto }),
  cola: [],             // eventos de entrada pendientes
  corriendo: false, visible: true,
};

// lectura sincrona por rangos de un archivo remoto grande (solo en Worker): cache de trozos
class Remoto {
  constructor(url, tam, opt) {
    this.url = url; this.tam = tam; this.trozo = (opt && opt.trozo) || (256 << 10);
    this.cache = new Map(); this.maxTrozos = (opt && opt.maxTrozos) || 600;
    this.bytes = 0; this.peticiones = 0;
  }
  trozoN(i) {
    let t = this.cache.get(i);
    if (t) { this.cache.delete(i); this.cache.set(i, t); return t; }
    const ini = i * this.trozo, fin = Math.min(this.tam, ini + this.trozo) - 1;
    const x = new XMLHttpRequest();
    x.open('GET', this.url, false);
    x.setRequestHeader('Range', 'bytes=' + ini + '-' + fin);
    x.overrideMimeType('text/plain; charset=x-user-defined'); // lectura sincrona: se pide como texto binario
    x.send(null);
    if (x.status !== 206 && x.status !== 200) throw new Error('Range ' + x.status + ' ' + this.url);
    const s = x.responseText; const n = fin - ini + 1; const u = new Uint8Array(n);
    if (x.status === 200 && s.length > n) { for (let k = 0; k < n; k++) u[k] = s.charCodeAt(ini + k) & 255; } // el servidor ignoro Range
    else for (let k = 0; k < n; k++) u[k] = s.charCodeAt(k) & 255;
    this.bytes += n; this.peticiones++;
    this.cache.set(i, u);
    if (this.cache.size > this.maxTrozos) this.cache.delete(this.cache.keys().next().value);
    return u;
  }
  leer(desde, n, u8, dst) {
    let hecho = 0;
    while (hecho < n) {
      const pos = desde + hecho, i = Math.floor(pos / this.trozo), off = pos - i * this.trozo;
      const t = this.trozoN(i), k = Math.min(n - hecho, t.length - off);
      if (k <= 0) break;
      u8.set(t.subarray(off, off + k), dst + hecho);
      hecho += k;
    }
    return hecho;
  }
}

// partidas guardadas: IndexedDB (archivos escritos por el juego), por nombre de archivo
const Guardado = {
  db: null,
  abrir() {
    return new Promise((ok) => {
      try {
        const r = indexedDB.open('boz-partidas', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('archivos');
        r.onsuccess = () => { Guardado.db = r.result; ok(); };
        r.onerror = () => ok();
      } catch (_) { ok(); }
    });
  },
  todos() {
    return new Promise((ok) => {
      if (!Guardado.db) { ok([]); return; }
      try {
        const out = [], c = Guardado.db.transaction('archivos').objectStore('archivos').openCursor();
        c.onsuccess = () => { const k = c.result; if (k) { out.push([k.key, new Uint8Array(k.value)]); k.continue(); } else ok(out); };
        c.onerror = () => ok(out);
      } catch (_) { ok([]); }
    });
  },
  poner(n, datos) { try { if (Guardado.db) Guardado.db.transaction('archivos', 'readwrite').objectStore('archivos').put(datos, n); } catch (_) {} },
  quitar(n) { try { if (Guardado.db) Guardado.db.transaction('archivos', 'readwrite').objectStore('archivos').delete(n); } catch (_) {} },
};

async function bajar(url, tipo) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se pudo bajar ' + url + ' (' + r.status + ')');
  return tipo === 'json' ? r.json() : tipo === 'text' ? r.text() : r.arrayBuffer();
}

async function iniciar(m) {
  Mundo.est('Bajando el motor...');
  const base = m.base;
  const [imgB, meta, cfgTxt, loaderB] = await Promise.all([bajar(base + 'imagen.bin'), bajar(base + 'imagen.json', 'json'), bajar(base + 'config.txt', 'text'), bajar(base + 'blackops_loader.dz')]);
  const img = new Uint8Array(imgB);
  const BASE = meta.base_img, STUB = meta.base_stubs;
  const MEM = 0x0C000000;
  const buf = new ArrayBuffer(MEM); new Uint8Array(buf).set(img, BASE);
  const cpu = new Cpu({ buf, codeLo: BASE, codeHi: BASE + img.length, stubLo: STUB, stubHi: STUB + 8 * meta.nombres.length, roLo: BASE, roHi: BASE + 0x3dc000 });
  const cfg = new Icf(cfgTxt + '\n[derbh]\nautoload=' + m.paquete + '\n', { OS: 'ANDROID', CLASS: 'ANDROID', MODEL: 'Nexus S' });
  const fs = new FsVirtual();
  fs.montar('blackops_loader.dz', FsVirtual.deBuffer(new Uint8Array(loaderB)));
  const remoto = new Remoto(m.paqueteUrl, m.paqueteTam);
  fs.montar(m.paquete, remoto);
  await Guardado.abrir();
  for (const [n, d] of await Guardado.todos()) fs.montar(n, FsVirtual.enMemoria(d));
  fs.alGuardar = (n, d) => Guardado.poner(n, d);
  fs.alBorrar = (n) => Guardado.quitar(n);
  const dat = new Uint8Array(4); new DataView(dat.buffer).setUint32(0, meta.buildnum || 456612, true);
  fs.montar(m.paquete + '.dat', FsVirtual.deBuffer(dat));
  Mundo.remoto = remoto;

  const canvas = m.canvas;
  canvas.width = m.salidaW || m.ancho; canvas.height = m.salidaH || m.alto;
  // el juego dibuja en un framebuffer propio (Graficos); el canvas solo recibe la imagen final
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('No hay WebGL');
  const exts = ['WEBGL_compressed_texture_s3tc', 'OES_element_index_uint', 'OES_standard_derivatives', 'OES_texture_float', 'WEBGL_depth_texture', 'OES_vertex_array_object', 'EXT_texture_filter_anisotropic'];
  const tiene = {}; for (const e of exts) tiene[e] = !m.sinS3tc || e !== 'WEBGL_compressed_texture_s3tc' ? !!gl.getExtension(e) : false;
  const glh = new GlHle({
    gl, ancho: m.ancho, alto: m.alto, log: (t) => postMessage({ t: 'log', texto: t }),
    vendor: 'NVIDIA Corporation', renderer: 'NVIDIA Tegra 3',
    extensiones: ['GL_EXT_texture_compression_s3tc', 'GL_EXT_texture_compression_dxt1', 'GL_OES_depth_texture', 'GL_OES_packed_depth_stencil', 'GL_OES_rgb8_rgba8', 'GL_OES_standard_derivatives', 'GL_OES_element_index_uint'],
  });
  Mundo.tieneS3tc = tiene.WEBGL_compressed_texture_s3tc;
  glh.s3tcNativo = tiene.WEBGL_compressed_texture_s3tc;
  const gfx = new Graficos(gl, glh, m.ancho, m.alto);
  if (m.graficos) gfx.configurar(m.graficos);
  gfx.ajuste = m.ajuste || 'completa';
  glh.gfx = gfx; glh.aplicarVp();
  Mundo.gfx = gfx;
  // sonido: el mezclador corre aca (llama al codigo del juego) y la pagina lo reproduce con WebAudio
  const audio = {
    pcm: (a) => postMessage({ t: 'pcm', d: a }, [a.buffer]),
    general: (v) => postMessage({ t: 'snd', v }),
    musica: (x, rep) => typeof x === 'string' ? postMessage({ t: 'mus', nombre: x, rep }) : postMessage({ t: 'mus', datos: x, rep }, [x.buffer]),
    musicaParar: () => postMessage({ t: 'musStop' }),
    musicaPausa: (si) => postMessage({ t: 'musPausa', si }),
    musicaVol: (v) => postMessage({ t: 'musVol', v }),
  };
  const s3e = new S3e(cpu, meta.nombres, { cfg, fs, gl: glh, audio, ancho: m.ancho, alto: m.alto, log: (t) => postMessage({ t: 'log', texto: t }), trazar: m.trazar ? Object.fromEntries(m.trazar.split(',').map((k) => [k, true])) : {}, filtro: m.filtro, heapLo: 0x01000000, heapHi: 0x0A000000 });
  cpu.hle = s3e.tabla;
  cpu.R[13] = 0x0B000000; cpu.R[14] = Cpu.MAGIC;
  Mundo.cpu = cpu; Mundo.s3e = s3e; Mundo.gl = gl; Mundo.pc = BASE;
  Mundo.est('Arrancando...');
  postMessage({ t: 'listo' });
  Mundo.corriendo = true;
  paso();
}

let cuadros = 0, t0 = 0;
function paso() {
  if (!Mundo.corriendo) return;
  const { cpu, s3e } = Mundo;
  try {
    let pc = Mundo.pc;
    s3e.yieldPedido = false;
    // entrada pendiente: se entrega al guest antes de seguir
    s3e.tic();
    while (Mundo.cola.length) s3e.entrada(Mundo.cola.shift());
    pc = cpu.run(pc);
    if (s3e.quit) { postMessage({ t: 'salida', codigo: s3e.salida }); Mundo.corriendo = false; return; }
    Mundo.pc = s3e.yieldPedido ? cpu.R[14] : pc;
    if (!s3e.yieldPedido) { postMessage({ t: 'error', texto: 'el guest termino sin pedir yield' }); Mundo.corriendo = false; return; }
  } catch (e) {
    postMessage({ t: 'error', texto: String(e && e.stack || e) + ' pc=' + (Mundo.cpu.pc >>> 0).toString(16) + ' lr=' + (Mundo.cpu.R[14] >>> 0).toString(16) });
    Mundo.corriendo = false; return;
  }
  if (++cuadros % 60 === 0) {
    const ahora = performance.now();
    postMessage({ t: 'fps', fps: 60000 / (ahora - t0), bloques: Mundo.cpu.nblocks, red: Mundo.remoto ? Mundo.remoto.bytes : 0, peticiones: Mundo.remoto ? Mundo.remoto.peticiones : 0 });
    t0 = ahora;
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(paso); else setTimeout(paso, 0);
}

if (_w) {
  onmessage = (e) => {
    const m = e.data;
    if (m.t === 'init') iniciar(m).catch((err) => postMessage({ t: 'error', texto: String(err && err.stack || err) }));
    else if (m.t === 'ptr' || m.t === 'tecla') { Mundo.cola.push(m); if (m.t === 'ptr' && Mundo.gfx) Mundo.gfx.entrada(m); }
    else if (m.t === 'graficos') { if (Mundo.gfx) { Mundo.gfx.configurar(m.cfg); if (m.ajuste) Mundo.gfx.ajuste = m.ajuste; } }
    else if (m.t === 'musFin') { if (Mundo.s3e) Mundo.s3e.musicaTermino(); }
    else if (m.t === 'tam') { if (Mundo.gfx) { Mundo.gfx.gl.canvas.width = m.w; Mundo.gfx.gl.canvas.height = m.h; Mundo.gfx.salida(m.w, m.h); } }
    else if (m.t === 'visible') { Mundo.visible = m.v; if (m.v && !Mundo.corriendo && Mundo.cpu) { Mundo.corriendo = true; paso(); } else if (!m.v) Mundo.corriendo = false; }
  };
}
