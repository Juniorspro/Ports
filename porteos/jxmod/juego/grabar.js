// ---------------------------------------------------------------------------------------------------------
// modo grabación: grabar el juego desde el juego, con su sonido (Discord, Chillguy: con el grabador del celular «dejó de
// grabar el sonido interno del juego»; el dueño: «un modo grabación donde puedes elegir grabar pantalla desde el juego sin
// gastar rendimiento»).
//  · El video sale del lienzo del juego (WebGL): después de dibujar cada cuadro se copia a un lienzo 2D del tamaño del
//    video (720p, 1080p o el del lienzo) sólo cuando toca un cuadro del video (30 o 60 por segundo), y de ahí lo toma
//    canvas.captureStream. Los botones de la pantalla son HTML: no salen en el video (meterlos costaría dibujar la página
//    entera en cada cuadro, que el navegador no hace barato). Lo que sí se suma: el video del susto de la pizzería.
//  · El sonido sale del mismo AudioContext del juego: la salida general (AUD.master) también va a un
//    MediaStreamAudioDestinationNode, sin pasar por el sistema. Por eso no lo afecta lo que hace Android con el grabador
//    de pantalla (la segunda parte del pedido: ver el LEEME, «Grabar»). Las voces del chat (AUD.voz) y el micrófono van
//    sólo si se piden. Quedan afuera los YouTube (radio, tele, música de los emotes: son de otro sitio), la voz del
//    sistema de Verity y las maquinitas (cada una en su iframe aislado, con su propio sonido).
//  · MP4 (H.264 + AAC) si MediaRecorder lo sabe hacer (Chrome y la vista web de Android nuevos, Safari); si no, WebM.
//  · Se pausa junto con el juego: con la pausa abierta (y lo que se abre desde ella: Ajustes, Personaje), con el menú de
//    inicio arriba de la partida y con la app en segundo plano; sigue con los demás menús (props, emotes, chat), porque el
//    mundo sigue andando. Así el video no tiene ratos quietos con un menú que no se ve.
//  · Se guarda: en la compu, una descarga (JXMod_AAAA-MM-DD_HH-MM-SS.mp4); en la app, en la galería (Movies/JXMod), que
//    la app escribe mientras se graba, por pedazos (JXNativo.grab*, Web.java y Grabador.java): nunca el video entero en
//    memoria.
// ---------------------------------------------------------------------------------------------------------
const GRAB = { on: false, arrancando: false, inicio: false, pausa: false, rec: null, tipo: null, W: 0, H: 0, fps: 30, per: 33.3, prox: 0, cv: null, g: null,
  pista: null, dest: null, mez: null, voces: false, mic: false, micSrc: null, micSt: null, micDeVoz: null, dst: null, cadena: null, primero: true, cab: null,
  activo: 0, tAct: 0, cuadros: 0, bytes: 0, error: '', ind: null, indTxt: '', bt: null, pzBt: null, pzTxt: '', t: 0, fin: null, ult: null };
// los formatos, de mejor a peor: MP4 con H.264 y AAC (lo abre cualquier celular, la galería y las redes); si no, WebM
const GRAB_TIPOS = [
  ['video/mp4;codecs=avc1,mp4a.40.2', 'mp4', 'MP4 (H.264 + AAC)'], ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4', 'MP4 (H.264 + AAC)'],
  ['video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'mp4', 'MP4 (H.264 + AAC)'], ['video/mp4;codecs=avc1.42e01f,mp4a.40.2', 'mp4', 'MP4 (H.264 + AAC)'],
  ['video/webm;codecs=vp8,opus', 'webm', 'WebM (VP8 + Opus)'], ['video/webm;codecs=vp9,opus', 'webm', 'WebM (VP9 + Opus)'], ['video/webm', 'webm', 'WebM'],
];
function grabTipo() {
  if (typeof MediaRecorder !== 'function' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const L = window.__grabTipos || GRAB_TIPOS;   // (las pruebas pueden pedir otro orden)
  for (const t of L) { try { if (MediaRecorder.isTypeSupported(t[0])) return t; } catch (e) {} }
  return null;
}
// lo elegido (Ajustes del modo grabación): calidad (el lado corto: 720, 1080 o el del lienzo), cuadros, micrófono, voces y
// el botón en la pantalla
function grabOp() {
  const o = PREFS.grab && typeof PREFS.grab === 'object' ? PREFS.grab : (PREFS.grab = {});
  if (!['720', '1080', 'pant'].includes(o.cal)) o.cal = '720';
  if (o.fps !== 60) o.fps = 30;
  o.mic = !!o.mic; o.voces = !!o.voces; if (o.hud === undefined) o.hud = true; o.hud = !!o.hud;
  return o;
}
// el tamaño del video: el lado corto pedido y el otro con la forma de la pantalla (como el grabador del celular: «720p» en
// un celular de 20:9 da 1600×720); números pares, que piden los codificadores
function grabTam(cal) {
  const cw = (R.cv && R.cv.width) || 1280, ch = (R.cv && R.cv.height) || 720, par = (x) => Math.max(2, Math.round(x / 2) * 2);
  if (cal === 'pant') return [par(cw), par(ch)];
  const S = cal === '1080' ? 1080 : 720, a = cw / ch;
  return a >= 1 ? [par(S * a), S] : [S, par(S / a)];
}
// cuánto: lo que recomienda YouTube para subir (720p30 5 Mbps, 720p60 7,5, 1080p60 12) según los puntos por segundo, con
// un tope de 16 Mbps (un minuto: ~38 MB en 720p30, ~120 en 1080p60)
const grabBits = (W, H, fps) => Math.round(Math.min(16e6, Math.max(2e6, W * H * fps * (fps > 30 ? 0.11 : 0.15))));
const GRAB_AUDIO = 128000;
// (el codificador del aparato: los de los celulares baratos no siempre pasan de 1920 de ancho; WebCodecs dice si puede, y si
// no se achica hasta que entre —primero a lo que entra en 1920×1080, después en 1280×720—)
async function grabTamPosible(tipo, W, H, fps) {
  if (typeof VideoEncoder === 'undefined' || !VideoEncoder.isConfigSupported) return [W, H, false];
  const codec = tipo[1] === 'mp4' ? 'avc1.42e034' : 'vp8', puede = async (w, h) => {
    try { const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, framerate: fps, bitrate: grabBits(w, h, fps) }); return !!(r && r.supported); } catch (e) { return true; }
  };
  if (await puede(W, H)) return [W, H, false];
  for (const [a, b] of [[1920, 1080], [1280, 720]]) {
    const k = Math.min(1, a / Math.max(W, H), b / Math.min(W, H)), w = Math.max(2, Math.round(W * k / 2) * 2), h = Math.max(2, Math.round(H * k / 2) * 2);
    if (k < 1 && await puede(w, h)) return [w, h, true];
  }
  return [W, H, false];
}
// JXMod_2026-11-15_18-30-05.mp4 (la hora del aparato)
function grabNombre(ext, d) {
  d = d || new Date(); const z = (n) => String(n).padStart(2, '0');
  return `JXMod_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}.${ext}`;
}
const grabApp = () => typeof JXNativo !== 'undefined' && JXNativo && typeof JXNativo.grabar === 'function' && JXNativo.grabar() >= 1;

// ---------------- la duración en el archivo ----------------
// Chrome graba el WebM sin la duración (los reproductores muestran --:-- y la galería no deja adelantar) y el MP4 en
// fragmentos sin la duración total. Al primer pedazo (que trae la cabecera) se le hace lugar para la duración, en cero, y
// al terminar se escribe el número ahí: grabCabeza devuelve la cabecera nueva y parche(ms) → [[posición, bytes], …].
// (en las dos: undefined si faltan bytes —la cabecera sigue en el pedazo siguiente—, null si no es lo esperado)
const grabEbmlId = (b, o) => { if (o >= b.length) return undefined; const x = b[o]; let L = 1; while (L <= 4 && !(x & (0x80 >> (L - 1)))) L++; if (L > 4) return null; if (o + L > b.length) return undefined; let v = 0; for (let i = 0; i < L; i++) v = v * 256 + b[o + i]; return { v, L }; };
const grabEbmlTam = (b, o) => {
  if (o >= b.length) return undefined; const x = b[o]; let L = 1; while (L <= 8 && !(x & (0x80 >> (L - 1)))) L++; if (L > 8) return null; if (o + L > b.length) return undefined;
  const m = (0x80 >> (L - 1)) - 1; let v = x & m, todo = v === m; for (let i = 1; i < L; i++) { v = v * 256 + b[o + i]; if (b[o + i] !== 255) todo = false; }
  return { v, L, desconocido: todo };
};
function grabCabWebm(b) {
  const F = 'falta', e = grabEbmlId(b, 0); if (e === undefined) return F; if (!e || e.v !== 0x1A45DFA3) return null;
  const es = grabEbmlTam(b, e.L); if (es === undefined) return F; if (!es) return null;
  let o = e.L + es.L + es.v; const sg = grabEbmlId(b, o); if (sg === undefined) return F; if (!sg || sg.v !== 0x18538067) return null;
  const ss = grabEbmlTam(b, o + sg.L); if (ss === undefined) return F; if (!ss) return null; o += sg.L + ss.L;
  for (let n = 0; n < 8; n++) {
    const id = grabEbmlId(b, o); if (id === undefined) return F; if (!id) return null;
    const sz = grabEbmlTam(b, o + id.L); if (sz === undefined) return F; if (!sz) return null;
    if (id.v === 0x1F43B675 || id.v === 0x1654AE6B) return null;   // (un Cluster o los Tracks antes que la Info: no es lo de Chrome)
    if (id.v === 0x1549A966) {
      const ini = o + id.L + sz.L, fin = ini + sz.v; if (sz.desconocido) return null; if (fin > b.length) return F;
      let escala = 1e6;
      for (let p = ini; p < fin;) {
        const ci = grabEbmlId(b, p), cs = ci && grabEbmlTam(b, p + ci.L); if (!ci || !cs) return null;
        if (ci.v === 0x4489) return null;   // (ya trae la duración)
        if (ci.v === 0x2AD7B1) { let v = 0; for (let i = 0; i < cs.v; i++) v = v * 256 + b[p + ci.L + cs.L + i]; escala = v || 1e6; }
        p += ci.L + cs.L + cs.v;
      }
      // la Info con un elemento más: Duration (0x4489), un float de 8 bytes, en 0
      const nuevo = sz.v + 11; let L = sz.L; if (nuevo > Math.pow(2, 7 * L) - 2) L = 8;
      const tam = new Uint8Array(L); let v = nuevo; for (let i = L - 1; i >= 0; i--) { tam[i] = v % 256; v = Math.floor(v / 256); } tam[0] |= 0x80 >> (L - 1);
      const out = new Uint8Array(b.length + 11 + L - sz.L); let w = o + id.L;
      out.set(b.subarray(0, w), 0); out.set(tam, w); w += L; out.set(b.subarray(ini, fin), w); w += sz.v;
      out.set([0x44, 0x89, 0x88], w); w += 3; const pos = w; w += 8; out.set(b.subarray(fin), w);
      return { bytes: out, parche: (ms) => { const d = new DataView(new ArrayBuffer(8)); d.setFloat64(0, ms * 1e6 / escala); return [[pos, new Uint8Array(d.buffer)]]; } };
    }
    if (sz.desconocido) return null;
    o += id.L + sz.L + sz.v;
  }
  return null;
}
// MP4 fragmentado (el de Chrome): se agrega «mehd» —la duración de todos los fragmentos— en «mvex» y al final se completa
// también la de «mvhd», «tkhd» y «mdhd» (la galería de Android lee esas). Sólo si los fragmentos cuentan sus datos desde su
// propio «moof» (default-base-is-moof): así correr lo que sigue 20 bytes no rompe nada.
function grabCabMp4(b) {
  const u32 = (o) => b[o] * 16777216 + b[o + 1] * 65536 + b[o + 2] * 256 + b[o + 3], tipo = (o) => String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
  const hijos = (o, fin, f) => { while (o + 8 <= fin) { const t = u32(o); if (t < 8 || o + t > fin) return false; f(tipo(o), o, t); o += t; } return true; };
  let moov = -1, mt = 0, moof = -1;
  hijos(0, b.length, (k, o, t) => { if (k === 'moov' && moov < 0) { moov = o; mt = t; } else if (k === 'moof' && moof < 0) moof = o; });
  if (moov < 0) { if (b.length < 8 || tipo(0) === 'ftyp') return 'falta'; return null; }   // (la cabecera sigue en el pedazo siguiente)
  let mvhd = -1, mvex = -1, mxt = 0, mehd = false; const tk = [], md = [];
  hijos(moov + 8, moov + mt, (k, o, t) => {
    if (k === 'mvhd') mvhd = o; else if (k === 'mvex') { mvex = o; mxt = t; hijos(o + 8, o + t, (k2) => { if (k2 === 'mehd') mehd = true; }); }
    else if (k === 'trak') hijos(o + 8, o + t, (k2, o2, t2) => { if (k2 === 'tkhd') tk.push(o2); else if (k2 === 'mdia') hijos(o2 + 8, o2 + t2, (k3, o3) => { if (k3 === 'mdhd') md.push(o3); }); });
  });
  if (mvhd < 0 || mvex < 0 || mehd) return null;
  // (si ya vino el primer moof en este pedazo, se mira que cuente desde sí mismo; el de Chrome siempre lo hace)
  if (moof > 0) { let ok = true; hijos(moof + 8, b.length, (k, o, t) => { if (k === 'traf') hijos(o + 8, o + t, (k2, o2) => { if (k2 === 'tfhd' && !(b[o2 + 9] & 0x02)) ok = false; }); }); if (!ok) return null; }
  const M = 20, corre = (o) => (o >= mvex + 8 ? o + M : o), out = new Uint8Array(b.length + M);
  out.set(b.subarray(0, mvex + 8), 0); out.set([0, 0, 0, M, 0x6d, 0x65, 0x68, 0x64, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], mvex + 8); out.set(b.subarray(mvex + 8), mvex + 8 + M);
  const pon32 = (o, v) => { out[o] = (v >>> 24) & 255; out[o + 1] = (v >>> 16) & 255; out[o + 2] = (v >>> 8) & 255; out[o + 3] = v & 255; };
  pon32(moov, mt + M); pon32(mvex, mxt + M);
  const v1 = (o) => b[o + 8] === 1, mEsc = v1(mvhd) ? u32(mvhd + 28) : u32(mvhd + 20);
  const num = (n, L) => { const a = new Uint8Array(L); let v = Math.max(0, Math.round(n)); for (let i = L - 1; i >= 0; i--) { a[i] = v % 256; v = Math.floor(v / 256); } return a; };
  return { bytes: out, parche: (ms) => {
    const P = [[mvex + 8 + 12, num(ms * mEsc / 1000, 8)]], d = (o, off0, off1) => (v1(o) ? [corre(o) + off1, 8] : [corre(o) + off0, 4]);
    { const [p, L] = d(mvhd, 24, 32); P.push([p, num(ms * mEsc / 1000, L)]); }
    for (const o of tk) { const [p, L] = d(o, 28, 36); P.push([p, num(ms * mEsc / 1000, L)]); }
    for (const o of md) { const esc = v1(o) ? u32(o + 28) : u32(o + 20), [p, L] = d(o, 24, 32); P.push([p, num(ms * esc / 1000, L)]); }
    return P;
  } };
}
function grabCabeza(b, ext) { try { return ext === 'mp4' ? grabCabMp4(b) : grabCabWebm(b); } catch (e) { return null; } }
const grabJuntar = (a, b) => { const u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; };

// ---------------- adónde va: la descarga (la compu, el navegador) o la galería (la app) ----------------
// (después de la última coma: el tipo del pedazo de MediaRecorder también trae comas —«codecs=vp8,opus»—; el base64, nunca)
const grabB64 = (x) => new Promise((ok, mal) => { const f = new FileReader(); f.onload = () => { const s = String(f.result); ok(s.slice(s.lastIndexOf(',') + 1)); }; f.onerror = () => mal(f.error); f.readAsDataURL(x instanceof Blob ? x : new Blob([x])); });
function grabDestWeb(nombre, tipo) {
  const D = { partes: [], nombre,
    escribir: (x) => { D.partes.push(x); return Promise.resolve(); },
    parche: (L) => { const c = D.partes[0]; if (!(c instanceof Uint8Array)) return; for (const [p, b] of L) if (p + b.length <= c.length) c.set(b, p); },
    fin: async () => {
      const blob = new Blob(D.partes, { type: tipo[0].split(';')[0] }); D.partes = [];
      const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nombre; a.style.display = 'none';
      if (!window.__grabSinDescarga) { document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(() => URL.revokeObjectURL(u), 120000);
      return { ok: true, nombre, blob, web: true };
    },
    cancelar: () => { D.partes = []; } };
  return D;
}
// la app: Java abre el archivo en la galería (Movies/JXMod) y lo va escribiendo en otro hilo mientras se graba; acá se le
// manda cada pedazo en base64 (si se atrasa —más de 8 MB esperando—, se espera antes de mandar el siguiente)
async function grabDestApp(nombre, tipo) {
  const mime = tipo[0].split(';')[0];
  let r = {}; try { r = JSON.parse(JXNativo.grabEmpezar(nombre, mime) || '{}'); } catch (e) { r = {}; }
  if (r.permiso) {   // (Android 7, 8 y 9: el permiso para escribir en Movies; la app avisa con __jxGrabPermiso)
    aviso(T('gr.permiso'), 4);
    await new Promise((ok) => { window.__jxGrabPermiso = ok; setTimeout(ok, 60000); });
    try { r = JSON.parse(JXNativo.grabEmpezar(nombre, mime) || '{}'); } catch (e) { r = {}; }
  }
  if (!r.ok || !r.id) return null;
  const id = r.id, esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const D = { id, nombre, ruta: r.ruta || '',
    escribir: async (x) => {
      const b = await grabB64(x); const p = JXNativo.grabEscribir(id, b);
      if (p < 0) throw new Error('app');
      for (let i = 0; i < 300 && JXNativo.grabPendiente(id) > 8e6; i++) await esperar(50);
    },
    parche: async (L) => { for (const [p, b] of L) JXNativo.grabParche(id, p, await grabB64(b)); },
    fin: () => new Promise((ok) => {
      const t = setTimeout(() => ok({ ok: false, nombre }), 120000);
      window.__jxGrabListo = (j) => { clearTimeout(t); let x = {}; try { x = typeof j === 'string' ? JSON.parse(j) : j || {}; } catch (e) { x = {}; } ok(Object.assign({ nombre }, x)); };
      JXNativo.grabFin(id);
    }),
    cancelar: () => { try { JXNativo.grabCancelar(id); } catch (e) {} } };
  return D;
}

// ---------------- empezar y terminar ----------------
async function grabEmpezar() {
  if (GRAB.on || GRAB.arrancando || JUEGO.estado !== 'juego' || !R.cv) return false;
  const tipo = grabTipo(); if (!tipo) { aviso(T('gr.noSoporta'), 3); return false; }
  GRAB.arrancando = true;
  try {
    audioIniciar(); const c = AUD.ctx;
    if (c && c.state !== 'running' && !FONDO.oculto) c.resume().catch(() => {});
    const o = grabOp(); let [W, H] = grabTam(o.cal), chico = false; const fps = o.fps;
    [W, H, chico] = await grabTamPosible(tipo, W, H, fps);
    const nombre = grabNombre(tipo[1]);
    const dst = grabApp() ? await grabDestApp(nombre, tipo) : grabDestWeb(nombre, tipo);
    if (!dst) { aviso(T('gr.error'), 3); return false; }
    // el video: un lienzo 2D del tamaño del video; captureStream toma un cuadro cada vez que se dibuja (grabCuadro)
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { alpha: false }); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const pista = cv.captureStream().getVideoTracks()[0];
    // el sonido: la salida del juego (y las voces y el micrófono si se pidieron) a un destino propio
    let dest = null, mez = null;
    if (c && AUD.master) {
      dest = c.createMediaStreamDestination(); mez = c.createGain(); mez.connect(dest); AUD.master.connect(mez);
      if (o.voces && AUD.voz) AUD.voz.connect(mez);
    }
    const st = new MediaStream([pista].concat(dest ? dest.stream.getAudioTracks() : []));
    const bits = grabBits(W, H, fps);
    const rec = new MediaRecorder(st, { mimeType: tipo[0], videoBitsPerSecond: bits, audioBitsPerSecond: GRAB_AUDIO });
    Object.assign(GRAB, { on: true, inicio: true, pausa: false, rec, tipo, W, H, fps, per: 1000 / fps, prox: 0, cv, g, pista, dest, mez, voces: o.voces, mic: o.mic,
      micSrc: null, micSt: null, micDeVoz: null, dst, cadena: Promise.resolve(), primero: true, cab: null, cabPend: null, activo: 0, tAct: 0, cuadros: 0, bytes: 0, error: '', bits, nombre, fin: null, t: 0 });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) grabPedazo(e.data); };
    rec.onerror = (e) => { GRAB.error = (e && e.error && e.error.name) || 'error'; grabParar(); };
    rec.onstop = () => grabCerrar();
    if (o.mic) grabMicPoner();
    grabIndicador(); grabBotones();
    GRAB.avisoTxt = T('gr.empieza').replace('{f}', tipo[2]) + (chico ? ' · ' + W + '×' + H : ''); aviso(GRAB.avisoTxt, 3);
    return true;
  } catch (e) {
    console.warn('grabar', e); aviso(T('gr.error'), 3); grabLimpiar(); return false;
  } finally { GRAB.arrancando = false; }
}
// cada pedazo, en orden: el primero trae la cabecera (se le hace lugar para la duración; si vino cortada, se junta con el
// siguiente hasta que esté entera); en la app, cada uno se manda ya
function grabPedazo(blob) {
  GRAB.bytes += blob.size;
  const D = GRAB.dst, ext = GRAB.tipo ? GRAB.tipo[1] : '';
  GRAB.cadena = GRAB.cadena.then(async () => {
    if (!D) return;
    if (!GRAB.primero) return D.escribir(blob);
    const b = new Uint8Array(await blob.arrayBuffer()), u = GRAB.cabPend ? grabJuntar(GRAB.cabPend, b) : b, c = grabCabeza(u, ext);
    if (c === 'falta' && u.length < 4e6) { GRAB.cabPend = u; return; }
    GRAB.primero = false; GRAB.cabPend = null; GRAB.cab = c && c !== 'falta' ? c : null;
    return D.escribir(GRAB.cab ? GRAB.cab.bytes : u);
  }).catch((e) => { console.warn('grabar', e); GRAB.error = GRAB.error || 'guardar'; if (GRAB.on) grabParar(); });   // (no se pudo guardar: no sigue grabando de gusto)
}
function grabParar() {
  if (!GRAB.on) return;
  GRAB.on = false; grabActivoSumar(performance.now());
  try { if (GRAB.rec && GRAB.rec.state !== 'inactive') GRAB.rec.stop(); else grabCerrar(); } catch (e) { grabCerrar(); }
  grabIndicador(); grabBotones();
}
const grabActivoSumar = (ahora) => { if (GRAB.tAct) { GRAB.activo += ahora - GRAB.tAct; GRAB.tAct = 0; } };
// (después del último pedazo: la duración en la cabecera, cerrar el archivo y avisar dónde quedó)
async function grabCerrar() {
  if (GRAB.cerrando) return; GRAB.cerrando = true;
  const D = GRAB.dst, ms = Math.round(GRAB.activo), err = GRAB.error;
  grabSoltarAudio();
  try { if (GRAB.pista) GRAB.pista.stop(); } catch (e) {}
  GRAB.guardando = true; grabBotones();
  let r = { ok: false };
  try {
    await GRAB.cadena;
    if (D && GRAB.cabPend) { await D.escribir(GRAB.cabPend); GRAB.cabPend = null; }   // (la cabecera nunca llegó entera: va como vino)
    if (D && GRAB.bytes > 0) {   // (con un error a mitad, se guarda lo que llegó)
      if (GRAB.cab && ms > 0) await D.parche(GRAB.cab.parche(ms));
      r = await D.fin();
    } else if (D) D.cancelar();
  } catch (e) { console.warn('grabar', e); r = { ok: false }; }
  GRAB.ult = Object.assign({ ms, bytes: GRAB.bytes, tipo: GRAB.tipo && GRAB.tipo[0], W: GRAB.W, H: GRAB.H, fps: GRAB.fps, cuadros: GRAB.cuadros, error: err }, r);
  grabLimpiar();
  if (GRAB.ult.bytes || err) grabAvisoFin(GRAB.ult);   // (cortada antes de empezar —se salió al toque—: nada que avisar)
}
function grabSoltarAudio() {
  try { if (GRAB.mez) { AUD.master.disconnect(GRAB.mez); } } catch (e) {}
  try { if (GRAB.mez && AUD.voz) AUD.voz.disconnect(GRAB.mez); } catch (e) {}
  grabMicSacar();
  if (typeof VOZ !== 'undefined') for (const C of VOZ.ent.values()) if (C.F && C.F.r && C._grRev !== undefined) { C.F.r.gain.value = C._grRev; delete C._grRev; }
  try { if (GRAB.mez) GRAB.mez.disconnect(); } catch (e) {}
}
function grabLimpiar() {
  Object.assign(GRAB, { on: false, inicio: false, pausa: false, rec: null, cv: null, g: null, pista: null, dest: null, mez: null, dst: null, cab: null, cerrando: false, guardando: false });
  grabIndicador(); grabBotones();
}
// el micrófono: el del chat de voz si está prendido (el mismo, sin abrir otro); si no, uno propio mientras se graba
async function grabMicPoner() {
  const c = AUD.ctx; if (!c || !GRAB.on) return;
  let st = typeof VOZ !== 'undefined' && VOZ.stream ? VOZ.stream : null;
  if (!st) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); } catch (e) { aviso(T('gr.sinMic'), 3); return; }
    if (!GRAB.on) { st.getTracks().forEach((t) => t.stop()); return; }
    GRAB.micSt = st;
  } else GRAB.micDeVoz = st;
  try { GRAB.micSrc = c.createMediaStreamSource(st); GRAB.micSrc.connect(GRAB.mez); } catch (e) { GRAB.micSrc = null; }
}
function grabMicSacar() {
  try { if (GRAB.micSrc) GRAB.micSrc.disconnect(); } catch (e) {}
  if (GRAB.micSt) GRAB.micSt.getTracks().forEach((t) => t.stop());
  GRAB.micSrc = GRAB.micSt = GRAB.micDeVoz = null;
}

// ---------------- cada cuadro (principal.js, después de dibujar) ----------------
// Se copia el lienzo del juego al del video sólo cuando toca un cuadro del video (con el juego a 60 y el video a 30, uno sí
// y uno no). Va justo después de dibujar: con preserveDrawingBuffer apagado, después el lienzo ya no tiene la imagen.
function grabCuadro() {
  if (GRAB.pzBt && UI.abierto === 'pausa') grabPausaBoton();
  if (GRAB.bt && GRAB.btEst !== JUEGO.estado) { GRAB.btEst = JUEGO.estado; grabBotones(); }   // (el botón de la HUD, sólo jugando)
  if (!GRAB.on) return;
  if (JUEGO.estado !== 'juego') { grabParar(); return; }   // (salió al menú: se guarda lo grabado)
  const ahora = performance.now();
  grabRevisarPausa(ahora);
  if (GRAB.pausa) { grabIndicadorTiempo(ahora); return; }
  if (GRAB.inicio) {
    // (el primer cuadro y recién ahí MediaRecorder: el video empieza con imagen; un pedazo cada medio segundo, así en la
    // app cada llamada lleva poco)
    GRAB.inicio = false; grabDibujar(); GRAB.prox = ahora + GRAB.per;
    try { GRAB.rec.start(500); } catch (e) { GRAB.error = 'start'; grabParar(); return; }
    GRAB.tAct = ahora; GRAB.t = ahora;
  } else if (ahora + GRAB.per * 0.25 >= GRAB.prox) {
    grabDibujar(); GRAB.prox += GRAB.per; if (GRAB.prox < ahora - GRAB.per) GRAB.prox = ahora + GRAB.per;
  }
  // (las voces sin pedir: su eco también queda afuera —va por el eco general del juego—; vuelve al terminar)
  if (!GRAB.voces && typeof VOZ !== 'undefined' && VOZ.ent.size) for (const C of VOZ.ent.values()) if (C.F && C.F.r && C._grRev === undefined) { C._grRev = C.F.r.gain.value; C.F.r.gain.value = 0; }
  // (el micrófono del chat cambió —se suelta en segundo plano y se vuelve a abrir—: se engancha el nuevo)
  if (GRAB.mic && GRAB.micDeVoz && typeof VOZ !== 'undefined' && VOZ.stream && VOZ.stream !== GRAB.micDeVoz) { grabMicSacar(); grabMicPoner(); }
  grabIndicadorTiempo(ahora);
}
function grabDibujar() {
  const g = GRAB.g, cv = R.cv; if (!g || !cv) return;
  const W = GRAB.W, H = GRAB.H, k = Math.min(W / cv.width, H / cv.height), w = cv.width * k, h = cv.height * k;
  // (siempre de negro primero: donde el juego deja un hueco —la tele de YouTube— el cuadro de antes quedaba debajo y se
  // sumaban: salía negro con rayas. Ahí va la tapa del video: el video de YouTube es de otro sitio y no se puede copiar;
  // lo que pasa por delante de la tele la sigue tapando, porque el juego va encima)
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const ox = (W - w) / 2, oy = (H - h) / 2;
  if (typeof TELE !== 'undefined' && TELE.pp && YT.vid) {
    const t = pantTapa(YT.vid), kx = w / (TELE.ppW || cv.width), ky = h / (TELE.ppH || cv.height);
    if (t && t.im) { try { GRAB.tapas = (GRAB.tapas || 0) + (pantTapaEn(g, t.im, TELE.pp.map(([x, y]) => [ox + x * kx, oy + y * ky]), 5) ? 1 : 0); } catch (e) {} }
  }
  g.drawImage(cv, ox, oy, w, h);
  // (el susto de la pizzería es un video encima del juego: también va)
  if (typeof NOC !== 'undefined' && NOC.susto && NOC.ui && NOC.ui.video && !NOC.susto.tres && !NOC.susto.est) {
    const v = NOC.ui.video; if (v.readyState >= 2 && v.videoWidth) { const kv = Math.max(W / v.videoWidth, H / v.videoHeight); g.drawImage(v, (W - v.videoWidth * kv) / 2, (H - v.videoHeight * kv) / 2, v.videoWidth * kv, v.videoHeight * kv); }
  }
  GRAB.cuadros++;
}
// ¿el juego está en pausa? (la pausa y lo que se abre desde ella, el menú de inicio arriba de la partida, la app en segundo plano)
function grabEnPausa() {
  if (typeof FONDO !== 'undefined' && FONDO.oculto) return true;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
  const a = UI.abierto; if (a === 'pausa' || a === 'grabar' || a === 'personaje') return true;
  if (typeof RB !== 'undefined' && RB.desdeJuego && typeof rbVisible === 'function' && rbVisible()) return true;
  return false;
}
function grabRevisarPausa(ahora) {
  if (!GRAB.on || GRAB.inicio || !GRAB.rec) return;
  ahora = ahora || performance.now();
  const p = grabEnPausa(); if (p === GRAB.pausa) return;
  GRAB.pausa = p;
  try {
    if (p) { if (GRAB.rec.state === 'recording') GRAB.rec.pause(); grabActivoSumar(ahora); }
    else { if (GRAB.rec.state === 'paused') GRAB.rec.resume(); GRAB.tAct = ahora; GRAB.prox = ahora; }
  } catch (e) {}
  grabIndicador();
}
// (en segundo plano no hay cuadros: la pausa se pone apenas la página deja de verse, por el aviso de la app o del navegador)
// (y una vez por segundo, por si el juego no dibuja —el menú principal con el dibujo en pausa—: si se salió de la partida
// grabando, se guarda lo grabado)
setInterval(() => { if (GRAB.on && JUEGO.estado !== 'juego') grabParar(); }, 1000);
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => grabRevisarPausa());
  addEventListener('pagehide', () => grabRevisarPausa());
  const f0 = window.__jxFondo; if (typeof f0 === 'function') window.__jxFondo = (si) => { const r = f0(si); grabRevisarPausa(); return r; };
}

// ---------------- lo que se ve ----------------
Object.assign(GLIFOS, {
  rec: '<circle cx="12" cy="12" r="7.5" fill="currentColor" stroke="none"/>',
  compartir: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4"/>',
});
const grabMMSS = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const grabTiempo = (ahora) => GRAB.activo + (GRAB.tAct ? (ahora || performance.now()) - GRAB.tAct : 0);
// el indicador: punto rojo y el tiempo, arriba al medio; se toca y termina
function grabIndicador() {
  let e = GRAB.ind;
  if (!e) {
    e = document.createElement('button'); e.id = 'grabInd'; e.type = 'button'; e.className = 'oc';
    e.innerHTML = '<i></i><b>0:00</b>';
    e.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); grabParar(); });
    e.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
    (document.getElementById('hud') || document.body).appendChild(e); GRAB.ind = e;
  }
  const ve = GRAB.on || GRAB.arrancando;
  if (e.classList.contains('oc') === ve) { e.classList.toggle('oc', !ve); if (typeof vozHudUbicar === 'function') vozHudUbicar(); }
  e.classList.toggle('pausa', !!GRAB.pausa);
  e.setAttribute('aria-label', T(GRAB.pausa ? 'gr.enPausa' : 'gr.grabando') + ' · ' + T('gr.tocaParar'));
  e.title = e.getAttribute('aria-label');
  grabIndicadorTiempo();
}
function grabIndicadorTiempo(ahora) {
  if (!GRAB.ind) return;
  const t = grabMMSS(grabTiempo(ahora)), x = GRAB.pausa ? t + ' · ' + T('gr.enPausa') : t;
  if (x !== GRAB.indTxt) { GRAB.indTxt = x; GRAB.ind.querySelector('b').textContent = x; }
}
// el botón de la pausa: «Grabar» abre las opciones; grabando, «Terminar» (y el tiempo)
function grabPausaBoton() {
  const b = GRAB.pzBt; if (!b) return;
  const x = GRAB.on ? T('gr.terminar') + ' · ' + grabMMSS(grabTiempo()) : GRAB.guardando ? T('gr.guardando') : T('gr.grabar');
  if (x !== GRAB.pzTxt) { GRAB.pzTxt = x; b.querySelector('span').textContent = x; }
  b.classList.toggle('on', GRAB.on);
}
function grabBotones() {
  grabPausaBoton();
  const b = GRAB.bt; if (b) { b.classList.toggle('on', GRAB.on); b.style.display = grabOp().hud && JUEGO.estado === 'juego' ? '' : 'none'; }
}
// el botón chico de la pantalla (arriba a la izquierda, con los del sistema; se esconde en las opciones): un toque empieza
// con lo último elegido y otro termina
function grabBotonHud() {
  let b = $('grabBt');
  if (!b) {
    const ai = $('arribaIz'); if (!ai) return;
    b = document.createElement('div'); b.id = 'grabBt'; b.className = 'redondo bt grabBt'; b.innerHTML = glifo('rec') + '<small>(F9)</small>';   // (en la compu, la tecla, como los demás; en el celular no se ve)
    b.setAttribute('role', 'button'); b.setAttribute('aria-label', T('gr.grabar'));
    b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); if (GRAB.on) grabParar(); else grabEmpezar(); };
    ai.appendChild(b); GRAB.bt = b;
  }
  grabBotones();
}
// (en la HUD del celular, con los del sistema —hud.js y hudorden.js—, después de las voces del chat)
if (typeof HUD_TACTIL !== 'undefined') HUD_TACTIL.push(['#grabBt', 0, 1, 363.6, -140, 80, 32]);
if (typeof HUD_ZONAS !== 'undefined' && HUD_ZONAS.sis && !HUD_ZONAS.sis.l.includes('#grabBt')) HUD_ZONAS.sis.l.push('#grabBt');
if (typeof HUD_ZID !== 'undefined') { HUD_ZID.grabar = '#grabBt'; if (typeof HUD_ZSEL !== 'undefined') HUD_ZSEL['#grabBt'] = 'grabar'; }
if (typeof PANEL_DE !== 'undefined') PANEL_DE.grabar = 'grabPan';
// (la tecla F9 en la compu: empieza o termina)
addEventListener('keydown', (e) => {
  if (e.code !== 'F9' || e.repeat || JUEGO.estado !== 'juego') return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  e.preventDefault(); if (GRAB.on) grabParar(); else grabEmpezar();
});

// ---------------- las opciones (desde la pausa) ----------------
function grabPanel() {
  let P = $('grabPan'); if (P) return P;
  P = document.createElement('div'); P.id = 'grabPan'; P.className = 'panel oc';
  P.innerHTML = `<div class="caja grCaja" role="dialog" aria-modal="true">
  <div class="grCab"><span class="grTit"><i>${glifo('rec')}</i><b data-t="gr.titulo"></b></span><button class="grX mmX" type="button" data-a="x">${glifo('no')}</button></div>
  <div class="grFila"><span data-t="gr.calidad"></span><div class="grSeg" data-o="cal"><button type="button" data-v="720">720p</button><button type="button" data-v="1080">1080p</button><button type="button" data-v="pant"></button></div>
    <div class="grSeg" data-o="fps"><button type="button" data-v="30">30</button><button type="button" data-v="60">60</button></div><small class="grFps">fps</small></div>
  <div class="grFila"><span data-t="gr.sonido"></span><div class="grSeg grChk"><button type="button" class="sel fijo" aria-pressed="true" data-t="gr.juego"></button><button type="button" data-o="mic" data-t="gr.mic"></button><button type="button" data-o="voces" data-t="gr.voces"></button></div></div>
  <div class="grFila"><span></span><div class="grSeg grChk"><button type="button" data-o="hud"></button></div></div>
  <p class="grInfo"></p><p class="grInfo grSis oc"></p>
  <button class="grIr" type="button" data-a="ir"><i>${glifo('rec')}</i><span data-t="gr.empezar"></span></button></div>`;
  document.body.appendChild(P);
  P.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !P.contains(b)) return;
    const o = grabOp();
    if (b.dataset.a === 'x') { grabPanelCerrar(true); return; }
    if (b.dataset.a === 'ir') { grabPanelCerrar(false); cerrarPaneles(); grabEmpezar(); return; }
    const seg = b.parentElement;
    if (seg.dataset.o === 'cal') o.cal = b.dataset.v; else if (seg.dataset.o === 'fps') o.fps = +b.dataset.v;
    else if (b.dataset.o) o[b.dataset.o] = !o[b.dataset.o]; else return;
    guardarPrefs(); grabPanelPintar(); grabBotones();
  });
  return P;
}
function grabPanelPintar() {
  const P = $('grabPan'); if (!P) return; const o = grabOp(), tipo = grabTipo();
  for (const e of P.querySelectorAll('[data-t]')) e.textContent = T(e.dataset.t);
  P.querySelector('.grX').setAttribute('aria-label', T('cerrar'));
  // (el número aislado —bdi—: en árabe quedaba «480 الشاشةp»)
  const pant = P.querySelector('[data-v=pant]'), [pw, ph] = grabTam('pant'), nb = document.createElement('bdi'); nb.textContent = Math.min(pw, ph) + 'p'; pant.textContent = T('gr.pantalla') + ' '; pant.appendChild(nb);
  for (const b of P.querySelectorAll('[data-o=cal] button')) { const s = b.dataset.v === o.cal; b.classList.toggle('sel', s); b.setAttribute('aria-pressed', s); }
  for (const b of P.querySelectorAll('[data-o=fps] button')) { const s = +b.dataset.v === o.fps; b.classList.toggle('sel', s); b.setAttribute('aria-pressed', s); }
  for (const k of ['mic', 'voces', 'hud']) { const b = P.querySelector(`button[data-o=${k}]`); b.classList.toggle('sel', o[k]); b.setAttribute('aria-pressed', o[k]); }
  P.querySelector('button[data-o=hud]').textContent = T('gr.hud');
  const [W, H] = grabTam(o.cal), bits = grabBits(W, H, o.fps), mb = Math.round((bits + GRAB_AUDIO) * 60 / 8 / 1e6);
  const I = P.querySelectorAll('.grInfo');
  I[0].textContent = tipo ? `${tipo[2]} · ${W}×${H} · ${o.fps} fps · ${T('gr.porMin').replace('{n}', mb)} · ${T(grabApp() ? 'gr.dondeApp' : 'gr.dondeWeb').replace('{n}', '')}. ${T('gr.sinHud')}` + (AUD.master && !AUD.master.gain.value ? ' ' + T('gr.volCero') : '') : T('gr.noSoporta');
  // (en la app: si el grabador del celular puede grabar el sonido del juego ahora —ver grabSistema—)
  const s = grabSistema(); I[1].classList.toggle('oc', !s); if (s) { I[1].textContent = s.txt; I[1].classList.toggle('no', !s.ok); }
  P.querySelector('.grIr').disabled = !tipo;
}
function grabPanelAbrir() {
  if (GRAB.on) { grabParar(); return; }
  const P = grabPanel(); grabPanelPintar();
  $('pausa').classList.add('oc'); P.classList.remove('oc'); UI.abierto = 'grabar';
  if (typeof capasRevisar === 'function') capasRevisar();
  const b = P.querySelector('.grIr'); if (b && !document.body.classList.contains('tactil')) b.focus();
}
// (la X vuelve a la pausa; Empezar cierra todo —cerrarPaneles— y se juega grabando)
function grabPanelCerrar(aPausa) {
  const P = $('grabPan'); if (!P || P.classList.contains('oc')) return;
  P.classList.add('oc');
  if (aPausa && JUEGO.estado === 'juego') { UI.abierto = 'pausa'; $('pausa').classList.remove('oc'); }
  else if (UI.abierto === 'grabar') UI.abierto = null;
}
// el botón en el pie de la pausa (antes de los cuadros por segundo)
function grabPausaPoner() {
  const pie = document.querySelector('#pausa .pzPie'); if (!pie || $('bGrabar')) return;
  const b = document.createElement('button'); b.className = 'pzChico pzGrab'; b.id = 'bGrabar'; b.type = 'button';
  b.innerHTML = `<i>${glifo('rec')}</i><span></span>`;
  b.onclick = () => grabPanelAbrir();
  const f = $('pzFps'); if (f) pie.insertBefore(b, f); else pie.appendChild(b);
  GRAB.pzBt = b; GRAB.pzTxt = ''; grabPausaBoton();
}
// el aviso al terminar: dónde quedó y, si se puede, Compartir (y Ver, en la app)
function grabAvisoFin(r) {
  let A = $('grabAviso');
  if (!A) { A = document.createElement('div'); A.id = 'grabAviso'; A.className = 'oc'; A.setAttribute('role', 'status'); document.body.appendChild(A); }
  clearTimeout(A._t); A.innerHTML = '';
  // (si todavía se ve «Grabando · …» —una grabación corta, o el juego lento: el aviso cuenta tiempo del juego—, se va)
  { const a = $('aviso'); if (a && GRAB.avisoTxt && a.textContent === GRAB.avisoTxt) { a.classList.remove('ve'); UI.avisoT = 0; } }
  const cab = document.createElement('div'); cab.className = 'gaTxt';
  const t = document.createElement('b'), s = document.createElement('small'); cab.append(t, s); A.appendChild(cab);
  const fila = document.createElement('div'); fila.className = 'gaBts'; A.appendChild(fila);
  const boton = (txt, g, f) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = g ? glifo(g) : ''; const sp = document.createElement('span'); sp.textContent = txt; b.appendChild(sp); b.onclick = (e) => { e.stopPropagation(); f(); }; fila.appendChild(b); return b; };
  if (r && r.ok) {
    t.textContent = T('gr.guardado') + ' · ' + grabMMSS(r.ms || 0);
    // (en la app, si Android 7-9 no dio permiso para Movies, queda en la carpeta de la app: r.galeria === false y la ruta entera)
    s.textContent = r.web ? T('gr.dondeWeb').replace('{n}', ': ' + r.nombre) : r.galeria === false ? r.ruta || r.nombre : T('gr.dondeApp').replace('{n}', '/' + r.nombre);
    if (r.web && r.blob && navigator.canShare) {
      let f = null; try { f = new File([r.blob], r.nombre, { type: r.blob.type }); } catch (e) { f = null; }
      if (f && navigator.canShare({ files: [f] })) boton(T('gr.compartir'), 'compartir', () => navigator.share({ files: [f], title: r.nombre }).catch(() => {}));
    } else if (!r.web && r.uri && grabApp()) {
      boton(T('gr.compartir'), 'compartir', () => { try { JXNativo.grabCompartir(r.uri, r.mime || ''); } catch (e) {} });
      boton(T('gr.ver'), 'video', () => { try { JXNativo.grabVer(r.uri, r.mime || ''); } catch (e) {} });
    }
  } else { t.textContent = T('gr.error'); s.textContent = ''; console.warn('grabar: no se guardó', r && r.error); }
  boton(T('cerrar'), 'no', () => A.classList.add('oc')).classList.add('gaX');
  A.classList.remove('oc'); A._t = setTimeout(() => A.classList.add('oc'), 12000);
}
// (la app sabe si el grabador del celular puede grabar el sonido del juego —el modo de audio de Android y cómo sale lo que
// suena: JXNativo.audioEstado—; con el micrófono abierto, Chromium pone la app en modo llamada y eso Android no deja grabarlo)
function grabSistema() {
  if (typeof JXNativo === 'undefined' || !JXNativo || typeof JXNativo.audioEstado !== 'function') return null;
  let e = {}; try { e = JSON.parse(JXNativo.audioEstado() || '{}'); } catch (x) { return null; }
  const llamada = e.modo === 3 || e.modo === 2 || (e.usos || []).some((u) => u === 2 || u === 3);
  return { ok: !llamada, txt: T(llamada ? 'gr.sistemaNo' : 'gr.sistemaOk'), e };
}
// (la app avisa —Android 15 o más nuevo— cuando el grabador del celular empieza: si el micrófono del chat tiene la app en modo
// llamada, se dice qué pasa y qué hacer)
window.__jxGrabSistema = (si) => { if (+si !== 1) return; const s = grabSistema(); if (s && !s.ok) aviso(T('gr.sistemaNo'), 8); };

// ---------------- el estilo ----------------
{
  const st = document.createElement('style'); st.id = 'grabCss';
  st.textContent = `
#grabInd{position:absolute;left:50%;top:22px;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:10px;height:44px;min-width:96px;padding:0 18px 0 16px;border:1.5px solid rgba(255,255,255,.4);border-radius:22px;background:rgba(14,15,18,.72);color:#fff;font:600 17px/1 var(--jxF,Roboto,Arial,sans-serif);letter-spacing:.04em;font-variant-numeric:tabular-nums;cursor:pointer;pointer-events:auto;box-shadow:0 2px 10px rgba(0,0,0,.3);-webkit-tap-highlight-color:transparent}
#grabInd i{flex:none;width:12px;height:12px;border-radius:50%;background:#ff3b30;box-shadow:0 0 0 3px rgba(255,59,48,.28);animation:grabLat 1.2s ease-in-out infinite}
#grabInd.pausa i{background:#b9b7b1;box-shadow:none;animation:none}#grabInd.pausa{color:#d8d6d0}
#grabInd b{font-weight:600;white-space:nowrap}
@keyframes grabLat{50%{opacity:.35}}
body:not(.tactil) #grabInd{top:12px}
body.menuEncima #grabInd{opacity:.85}
.grabBt .gli{width:22px;height:22px;color:#ff3b30}.grabBt.on{background:rgba(220,60,60,.85)!important}.grabBt.on .gli{color:#fff;animation:grabLat 1.2s ease-in-out infinite}
#pausa .pzGrab .gli{width:16px;height:16px;color:#ff5a4f}#pausa .pzGrab.on{background:#a8231b;color:#fff}#pausa .pzGrab.on .gli{color:#fff}
body.tactil #pausa .pzSalir,body.tactil #pausa .pzChico{height:44px}
#grabPan .grCaja{background:var(--jxFo);color:var(--jxT);border:1px solid var(--jxLin);width:min(600px,calc(var(--vw)*94));max-height:calc(var(--vh)*94);overflow:auto;font-family:Roboto,Arial,sans-serif;padding:0 0 14px}
#grabPan .grCab{display:flex;align-items:center;gap:14px;min-height:52px;padding:0 12px 0 0}
#grabPan .grTit{display:flex;align-items:center;gap:14px;align-self:stretch;font:600 24px/1 var(--jxF);text-transform:uppercase;letter-spacing:.03em;min-width:0}
#grabPan .grTit i{flex:none;align-self:stretch;width:52px;display:flex;align-items:center;justify-content:center;background:#d8352b;color:#fff}
#grabPan .grTit .gli{width:18px;height:18px}#grabPan .grTit b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
#grabPan .grX{margin-left:auto;flex:none;width:44px;height:44px;border:0;background:var(--jxPl2);color:var(--jxT);display:flex;align-items:center;justify-content:center;cursor:pointer}
#grabPan .grX:hover,#grabPan .grX:focus-visible{background:var(--jxA);color:#121212;outline:0}
#grabPan .grFila{display:flex;align-items:center;gap:8px;padding:8px 14px 0;flex-wrap:wrap}
#grabPan .grFila>span{flex:none;width:86px;font:500 13px/1.2 var(--jxF);text-transform:uppercase;letter-spacing:.06em;color:var(--jxT2)}
#grabPan .grSeg{display:flex;gap:4px;flex-wrap:wrap}
#grabPan .grSeg button{height:44px;min-width:58px;padding:0 13px;border:0;background:var(--jxPl2);color:var(--jxT);font:500 15px/1 var(--jxF);letter-spacing:.03em;cursor:pointer;white-space:nowrap}
#grabPan .grSeg button:hover,#grabPan .grSeg button:focus-visible{background:var(--jxPl3);outline:0}
#grabPan .grSeg button.sel{background:var(--jxA);color:#121212}
#grabPan .grChk button{padding-inline-start:34px;position:relative}
#grabPan .grChk button:before{content:'';position:absolute;left:12px;top:50%;width:14px;height:14px;margin-top:-8px;border:1.5px solid currentColor;opacity:.7}
#grabPan .grChk button.sel:before{opacity:1;background:#121212;border-color:#121212;box-shadow:inset 0 0 0 3px var(--jxA)}
#grabPan .grChk button.fijo{cursor:default}
#grabPan .grFps{font:500 13px/1 var(--jxF);text-transform:uppercase;letter-spacing:.06em;color:var(--jxT2)}
#grabPan .grInfo{margin:10px 14px 0;font:400 12.5px/1.4 Roboto,Arial,sans-serif;color:var(--jxT2)}
#grabPan .grInfo.grSis{margin-top:6px;color:#9fd89a}#grabPan .grInfo.grSis.no{color:#ffb4a8}
#grabPan .grIr{display:flex;align-items:center;gap:12px;width:calc(100% - 28px);height:52px;margin:12px 14px 0;padding:0 18px;border:0;background:#d8352b;color:#fff;font:600 19px/1 var(--jxF);text-transform:uppercase;letter-spacing:.05em;cursor:pointer}
#grabPan .grIr:hover,#grabPan .grIr:focus-visible{background:#ec4237;outline:0}#grabPan .grIr:disabled{opacity:.45;cursor:default}
#grabPan .grIr .gli{width:16px;height:16px}
@media (max-height:420px){#grabPan .grCab{min-height:44px}#grabPan .grTit{font-size:21px}#grabPan .grTit i{width:44px}#grabPan .grFila{padding-top:6px}#grabPan .grIr{height:46px;margin-top:10px;font-size:18px}#grabPan .grInfo{margin-top:8px}}
@media (max-width:520px){#grabPan .grFila>span{width:100%}}
#grabAviso{position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 24px);padding:8px 8px 8px 16px;background:rgba(14,15,18,.94);border:1px solid rgba(239,237,231,.18);color:#efede7;box-shadow:0 6px 24px rgba(0,0,0,.4);font-family:Roboto,Arial,sans-serif}
#grabAviso .gaTxt{display:flex;flex-direction:column;gap:3px;min-width:0}
#grabAviso .gaTxt b{font:600 16px/1.2 var(--jxF);text-transform:uppercase;letter-spacing:.04em}
#grabAviso .gaTxt small{font-size:12.5px;color:#aeaca6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#grabAviso .gaBts{display:flex;gap:6px;flex:none}
#grabAviso button{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;border:0;background:#26272b;color:#efede7;font:500 14px/1 var(--jxF);text-transform:uppercase;letter-spacing:.05em;cursor:pointer}
#grabAviso button:hover,#grabAviso button:focus-visible{background:#313237;outline:0}
#grabAviso button.gaX{width:44px;padding:0;justify-content:center}#grabAviso button.gaX span{display:none}
#grabAviso button .gli{width:16px;height:16px}
`;
  document.head.appendChild(st);
}
// (al cargar: el botón de la pausa y el de la HUD; los textos se ponen al abrir la pausa, en el idioma de ese momento)
function grabIniciar() { grabPausaPoner(); grabBotonHud(); }
// (en la web con código y en la app el juego se descifra con la página ya cargada: sin esperar, esto correría en medio del
// armado, antes de que existan PREFS —principal.js, más abajo— y los textos de acá abajo; se deja para después)
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', grabIniciar); else setTimeout(grabIniciar, 0);

Object.assign(IDI3, {
  'gr.grabar': ['Grabar', 'Record', 'Gravar', 'Rekam', 'Rakam', 'I-record', '録画', 'บันทึก', 'Kaydet', 'تسجيل', 'Запись', 'Запис', 'Enregistrer', 'Aufnehmen'],
  'gr.titulo': ['Grabar video', 'Record video', 'Gravar vídeo', 'Rekam video', 'Rakam video', 'Mag-record ng video', '動画を録画', 'บันทึกวิดีโอ', 'Video kaydet', 'تسجيل فيديو', 'Запись видео', 'Запис відео', 'Enregistrer une vidéo', 'Video aufnehmen'],
  'gr.terminar': ['Terminar', 'Stop', 'Parar', 'Berhenti', 'Berhenti', 'Ihinto', '停止', 'หยุด', 'Durdur', 'إيقاف', 'Стоп', 'Стоп', 'Arrêter', 'Stopp'],
  'gr.guardando': ['Guardando…', 'Saving…', 'Salvando…', 'Menyimpan…', 'Menyimpan…', 'Sine-save…', '保存中…', 'กำลังบันทึก…', 'Kaydediliyor…', 'جارٍ الحفظ…', 'Сохранение…', 'Збереження…', 'Enregistrement…', 'Wird gespeichert…'],
  'gr.calidad': ['Calidad', 'Quality', 'Qualidade', 'Kualitas', 'Kualiti', 'Kalidad', '画質', 'คุณภาพ', 'Kalite', 'الجودة', 'Качество', 'Якість', 'Qualité', 'Qualität'],
  'gr.pantalla': ['Pantalla', 'Screen', 'Tela', 'Layar', 'Skrin', 'Screen', '画面', 'หน้าจอ', 'Ekran', 'الشاشة', 'Экран', 'Екран', 'Écran', 'Bildschirm'],
  'gr.sonido': ['Sonido', 'Sound', 'Som', 'Suara', 'Bunyi', 'Tunog', 'サウンド', 'เสียง', 'Ses', 'الصوت', 'Звук', 'Звук', 'Son', 'Ton'],
  'gr.juego': ['Juego', 'Game', 'Jogo', 'Game', 'Permainan', 'Laro', 'ゲーム', 'เกม', 'Oyun', 'اللعبة', 'Игра', 'Гра', 'Jeu', 'Spiel'],
  'gr.mic': ['Mi micrófono', 'My microphone', 'Meu microfone', 'Mikrofonku', 'Mikrofon saya', 'Aking mikropono', '自分のマイク', 'ไมค์ของฉัน', 'Mikrofonum', 'الميكروفون الخاص بي', 'Мой микрофон', 'Мій мікрофон', 'Mon micro', 'Mein Mikrofon'],
  'gr.voces': ['Voces del chat', 'Voice chat', 'Vozes do chat', 'Suara obrolan', 'Suara sembang', 'Voice chat', 'ボイスチャット', 'เสียงแชท', 'Sesli sohbet', 'الدردشة الصوتية', 'Голосовой чат', 'Голосовий чат', 'Chat vocal', 'Sprachchat'],
  'gr.hud': ['Botón ● REC en la pantalla', '● REC button on screen', 'Botão ● REC na tela', 'Tombol ● REC di layar', 'Butang ● REC di skrin', '● REC button sa screen', '画面に ● REC ボタン', 'ปุ่ม ● REC บนหน้าจอ', 'Ekranda ● REC düğmesi', 'زر ● REC على الشاشة', 'Кнопка ● REC на экране', 'Кнопка ● REC на екрані', 'Bouton ● REC à l’écran', '● REC-Taste auf dem Bildschirm'],
  'gr.porMin': ['~{n} MB por minuto', '~{n} MB per minute', '~{n} MB por minuto', '~{n} MB per menit', '~{n} MB seminit', '~{n} MB bawat minuto', '1分あたり約{n} MB', 'ประมาณ {n} MB ต่อนาที', 'dakikada ~{n} MB', '~{n} ميغابايت في الدقيقة', '~{n} МБ в минуту', '~{n} МБ за хвилину', '~{n} Mo par minute', '~{n} MB pro Minute'],
  'gr.dondeWeb': ['En tus descargas{n}', 'In your downloads{n}', 'Nos seus downloads{n}', 'Di folder unduhan{n}', 'Dalam muat turun{n}', 'Sa downloads mo{n}', 'ダウンロード{n}', 'ในโฟลเดอร์ดาวน์โหลด{n}', 'İndirilenlerde{n}', 'في التنزيلات{n}', 'В загрузках{n}', 'У завантаженнях{n}', 'Dans tes téléchargements{n}', 'In deinen Downloads{n}'],
  'gr.dondeApp': ['En la galería: Movies/JXMod{n}', 'In your gallery: Movies/JXMod{n}', 'Na galeria: Movies/JXMod{n}', 'Di galeri: Movies/JXMod{n}', 'Dalam galeri: Movies/JXMod{n}', 'Sa gallery: Movies/JXMod{n}', 'ギャラリー: Movies/JXMod{n}', 'ในแกลเลอรี: Movies/JXMod{n}', 'Galeride: Movies/JXMod{n}', 'في المعرض: Movies/JXMod{n}', 'В галерее: Movies/JXMod{n}', 'У галереї: Movies/JXMod{n}', 'Dans la galerie : Movies/JXMod{n}', 'In der Galerie: Movies/JXMod{n}'],
  'gr.sinHud': ['Los botones de la pantalla no salen en el video.', 'On-screen buttons are not in the video.', 'Os botões da tela não aparecem no vídeo.', 'Tombol di layar tidak ikut terekam.', 'Butang skrin tidak dirakam.', 'Hindi kasama sa video ang mga button sa screen.', '画面のボタンは動画に映りません。', 'ปุ่มบนหน้าจอจะไม่อยู่ในวิดีโอ', 'Ekrandaki düğmeler videoda görünmez.', 'أزرار الشاشة لا تظهر في الفيديو.', 'Кнопки на экране в видео не попадают.', 'Кнопки на екрані у відео не потрапляють.', 'Les boutons à l’écran n’apparaissent pas dans la vidéo.', 'Die Bildschirmtasten sind im Video nicht zu sehen.'],
  'gr.empezar': ['Empezar a grabar', 'Start recording', 'Começar a gravar', 'Mulai merekam', 'Mula merakam', 'Simulan ang pag-record', '録画を開始', 'เริ่มบันทึก', 'Kaydı başlat', 'بدء التسجيل', 'Начать запись', 'Почати запис', 'Commencer l’enregistrement', 'Aufnahme starten'],
  'gr.empieza': ['Grabando · {f}', 'Recording · {f}', 'Gravando · {f}', 'Merekam · {f}', 'Merakam · {f}', 'Nagre-record · {f}', '録画中 · {f}', 'กำลังบันทึก · {f}', 'Kaydediliyor · {f}', 'جارٍ التسجيل · {f}', 'Идёт запись · {f}', 'Йде запис · {f}', 'Enregistrement · {f}', 'Aufnahme · {f}'],
  'gr.grabando': ['Grabando', 'Recording', 'Gravando', 'Merekam', 'Merakam', 'Nagre-record', '録画中', 'กำลังบันทึก', 'Kaydediliyor', 'جارٍ التسجيل', 'Идёт запись', 'Йде запис', 'Enregistrement', 'Aufnahme läuft'],
  'gr.enPausa': ['en pausa', 'paused', 'pausado', 'dijeda', 'dijeda', 'naka-pause', '一時停止中', 'หยุดชั่วคราว', 'duraklatıldı', 'متوقف مؤقتًا', 'пауза', 'пауза', 'en pause', 'pausiert'],
  'gr.tocaParar': ['tocá para terminar y guardar', 'tap to stop and save', 'toque para parar e salvar', 'ketuk untuk berhenti dan simpan', 'ketik untuk berhenti dan simpan', 'i-tap para ihinto at i-save', 'タップで停止して保存', 'แตะเพื่อหยุดและบันทึก', 'durdurup kaydetmek için dokun', 'انقر للإيقاف والحفظ', 'нажми, чтобы остановить и сохранить', 'натисни, щоб зупинити й зберегти', 'touche pour arrêter et enregistrer', 'tippen zum Beenden und Speichern'],
  'gr.guardado': ['Video guardado', 'Video saved', 'Vídeo salvo', 'Video tersimpan', 'Video disimpan', 'Na-save ang video', '動画を保存しました', 'บันทึกวิดีโอแล้ว', 'Video kaydedildi', 'تم حفظ الفيديو', 'Видео сохранено', 'Відео збережено', 'Vidéo enregistrée', 'Video gespeichert'],
  'gr.compartir': ['Compartir', 'Share', 'Compartilhar', 'Bagikan', 'Kongsi', 'I-share', '共有', 'แชร์', 'Paylaş', 'مشاركة', 'Поделиться', 'Поділитися', 'Partager', 'Teilen'],
  'gr.ver': ['Ver', 'Watch', 'Ver', 'Tonton', 'Tonton', 'Panoorin', '見る', 'ดู', 'İzle', 'مشاهدة', 'Смотреть', 'Дивитися', 'Voir', 'Ansehen'],
  'gr.error': ['No se pudo grabar el video', 'Could not record the video', 'Não foi possível gravar o vídeo', 'Video tidak bisa direkam', 'Video tidak dapat dirakam', 'Hindi ma-record ang video', '動画を録画できませんでした', 'บันทึกวิดีโอไม่ได้', 'Video kaydedilemedi', 'تعذّر تسجيل الفيديو', 'Не удалось записать видео', 'Не вдалося записати відео', 'Impossible d’enregistrer la vidéo', 'Video konnte nicht aufgenommen werden'],
  'gr.noSoporta': ['Este navegador no puede grabar video: probá con Chrome', 'This browser can’t record video: try Chrome', 'Este navegador não grava vídeo: tente o Chrome', 'Browser ini tidak bisa merekam video: coba Chrome', 'Pelayar ini tidak boleh merakam video: cuba Chrome', 'Hindi kayang mag-record ng browser na ito: subukan ang Chrome', 'このブラウザでは録画できません: Chrome をお試しください', 'เบราว์เซอร์นี้บันทึกวิดีโอไม่ได้ ลองใช้ Chrome', 'Bu tarayıcı video kaydedemiyor: Chrome’u dene', 'هذا المتصفح لا يستطيع تسجيل الفيديو: جرّب Chrome', 'Этот браузер не умеет записывать видео: попробуй Chrome', 'Цей браузер не вміє записувати відео: спробуй Chrome', 'Ce navigateur ne peut pas enregistrer de vidéo : essaie Chrome', 'Dieser Browser kann kein Video aufnehmen: probier Chrome'],
  'gr.volCero': ['(El volumen del juego está en 0: el video va a salir sin sonido.)', '(Game volume is 0: the video will have no sound.)', '(O volume do jogo está em 0: o vídeo vai sair sem som.)', '(Volume game 0: video tidak akan bersuara.)', '(Kelantangan permainan 0: video tiada bunyi.)', '(0 ang volume ng laro: walang tunog ang video.)', '(ゲームの音量が0です: 動画は無音になります。)', '(เสียงเกมเป็น 0: วิดีโอจะไม่มีเสียง)', '(Oyun sesi 0: video sessiz olacak.)', '(صوت اللعبة على 0: سيكون الفيديو بلا صوت.)', '(Громкость игры 0: видео будет без звука.)', '(Гучність гри 0: відео буде без звуку.)', '(Le volume du jeu est à 0 : la vidéo sera muette.)', '(Spiellautstärke ist 0: das Video hat keinen Ton.)'],
  'gr.permiso': ['Dale permiso para guardar el video en la galería', 'Allow saving the video to your gallery', 'Dê permissão para salvar o vídeo na galeria', 'Izinkan menyimpan video ke galeri', 'Benarkan simpan video ke galeri', 'Payagang i-save ang video sa gallery', '動画をギャラリーに保存する許可をください', 'อนุญาตให้บันทึกวิดีโอลงแกลเลอรี', 'Videoyu galeriye kaydetmek için izin ver', 'اسمح بحفظ الفيديو في المعرض', 'Разреши сохранять видео в галерею', 'Дозволь зберігати відео в галерею', 'Autorise l’enregistrement de la vidéo dans la galerie', 'Erlaube das Speichern des Videos in der Galerie'],
  'gr.sinMic': ['Sin permiso para el micrófono: se graba sin tu voz', 'No microphone permission: recording without your voice', 'Sem permissão do microfone: grava sem a sua voz', 'Tanpa izin mikrofon: merekam tanpa suaramu', 'Tiada kebenaran mikrofon: dirakam tanpa suara anda', 'Walang pahintulot sa mikropono: walang boses mo', 'マイクの許可なし: 声なしで録画します', 'ไม่มีสิทธิ์ใช้ไมค์: บันทึกโดยไม่มีเสียงคุณ', 'Mikrofon izni yok: sesin olmadan kaydediliyor', 'لا إذن للميكروفون: يُسجَّل بدون صوتك', 'Нет доступа к микрофону: запись без твоего голоса', 'Немає доступу до мікрофона: запис без твого голосу', 'Pas d’accès au micro : enregistrement sans ta voix', 'Kein Mikrofonzugriff: Aufnahme ohne deine Stimme'],
  'gr.sistemaOk': ['Grabador del celular: ahora puede grabar el sonido del juego.', 'Phone screen recorder: it can record the game sound now.', 'Gravador do celular: agora pode gravar o som do jogo.', 'Perekam layar HP: sekarang bisa merekam suara game.', 'Perakam skrin telefon: kini boleh merakam bunyi permainan.', 'Screen recorder ng phone: kaya nang i-record ang tunog ng laro.', 'スマホの画面録画: 今はゲームの音を録音できます。', 'ตัวบันทึกหน้าจอของมือถือ: ตอนนี้บันทึกเสียงเกมได้', 'Telefonun ekran kaydedicisi: şu an oyun sesini kaydedebilir.', 'مسجّل شاشة الهاتف: يمكنه الآن تسجيل صوت اللعبة.', 'Запись экрана телефона: сейчас может записать звук игры.', 'Запис екрана телефона: зараз може записати звук гри.', 'Enregistreur d’écran du téléphone : il peut enregistrer le son du jeu.', 'Bildschirmaufnahme des Handys: kann den Spielton jetzt aufnehmen.'],
  'gr.sistemaNo': ['Grabador del celular: con el micrófono del chat de voz prendido, Android trata el sonido del juego como una llamada y no lo deja grabar. Apagá el micrófono o grabá desde acá.', 'Phone screen recorder: with the voice chat mic on, Android treats the game sound as a call and won’t let it be recorded. Turn the mic off or record from here.', 'Gravador do celular: com o microfone do chat de voz ligado, o Android trata o som do jogo como chamada e não deixa gravar. Desligue o microfone ou grave daqui.', 'Perekam layar HP: saat mikrofon obrolan suara menyala, Android menganggap suara game sebagai panggilan dan tidak bisa direkam. Matikan mikrofon atau rekam dari sini.', 'Perakam skrin telefon: bila mikrofon sembang suara hidup, Android anggap bunyi permainan sebagai panggilan dan tidak boleh dirakam. Matikan mikrofon atau rakam dari sini.', 'Screen recorder ng phone: habang naka-on ang mic ng voice chat, tawag ang turing ng Android sa tunog ng laro at hindi ito mare-record. I-off ang mic o mag-record dito.', 'スマホの画面録画: ボイスチャットのマイクがオンだと、Android はゲームの音を通話として扱い録音できません。マイクを切るか、ここから録画してください。', 'ตัวบันทึกหน้าจอของมือถือ: ถ้าเปิดไมค์แชทเสียง Android จะถือว่าเสียงเกมเป็นการโทรและไม่ให้บันทึก ปิดไมค์หรือบันทึกจากที่นี่', 'Telefonun ekran kaydedicisi: sesli sohbet mikrofonu açıkken Android oyun sesini arama sayar ve kaydettirmez. Mikrofonu kapat ya da buradan kaydet.', 'مسجّل شاشة الهاتف: عند تشغيل ميكروفون الدردشة الصوتية يعامل أندرويد صوت اللعبة كمكالمة ولا يسمح بتسجيله. أطفئ الميكروفون أو سجّل من هنا.', 'Запись экрана телефона: пока включён микрофон голосового чата, Android считает звук игры звонком и не даёт его записать. Выключи микрофон или записывай отсюда.', 'Запис екрана телефона: поки увімкнений мікрофон голосового чату, Android вважає звук гри дзвінком і не дає його записати. Вимкни мікрофон або записуй звідси.', 'Enregistreur d’écran du téléphone : avec le micro du chat vocal allumé, Android traite le son du jeu comme un appel et ne le laisse pas enregistrer. Coupe le micro ou enregistre d’ici.', 'Bildschirmaufnahme des Handys: Mit eingeschaltetem Sprachchat-Mikrofon behandelt Android den Spielton als Anruf und lässt ihn nicht aufnehmen. Schalte das Mikrofon aus oder nimm hier auf.'],
});
