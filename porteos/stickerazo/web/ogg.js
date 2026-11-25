// Ogg/Opus a partir de un audio (AudioBuffer): lo que WhatsApp usa en las notas de voz y en el audio de los stickers con
// sonido. Se codifica en el celular con WebCodecs (AudioEncoder, el Opus del navegador) y se arma el Ogg acá: la página
// OpusHead, la OpusTags y las de audio (cada paquete de 20 ms con su «granule» en muestras de 48 kHz). Mono, 48 kHz.
const SR = 48000, CUADRO = 960;   // (20 ms)

export const puedeOpus = () => typeof AudioEncoder === 'function' && typeof AudioData === 'function';

// el audio a 48 kHz mono (con OfflineAudioContext: remuestrea y mezcla los canales)
async function aMono48(buf) {
  if (buf.sampleRate === SR && buf.numberOfChannels === 1) return buf.getChannelData(0);
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * SR)), SR), s = off.createBufferSource();
  s.buffer = buf; s.connect(off.destination); s.start(); return (await off.startRendering()).getChannelData(0);
}

export async function oggOpus(buf, kbps = 48) {
  if (!puedeOpus()) throw new Error('este celular no codifica Opus');
  const pcm = await aMono48(buf), paquetes = []; let cab = null, falla = null;
  const enc = new AudioEncoder({ output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); paquetes.push(b); if (!cab && meta && meta.decoderConfig && meta.decoderConfig.description) cab = new Uint8Array(meta.decoderConfig.description); }, error: (e) => { falla = e; } });
  const cfg = { codec: 'opus', sampleRate: SR, numberOfChannels: 1, bitrate: kbps * 1000, opus: { frameDuration: 20000, application: 'audio' } };
  try { const s = await AudioEncoder.isConfigSupported(cfg); if (!s.supported) throw new Error('sin Opus'); } catch (e) { delete cfg.opus; }
  enc.configure(cfg);
  for (let i = 0; i < pcm.length; i += CUADRO) {
    const trozo = new Float32Array(CUADRO); trozo.set(pcm.subarray(i, Math.min(pcm.length, i + CUADRO)));
    const d = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: CUADRO, numberOfChannels: 1, timestamp: Math.round(i / SR * 1e6), data: trozo });
    enc.encode(d); d.close();
  }
  await enc.flush(); enc.close(); if (falla) throw falla;
  // (el «pre-skip»: lo que trae la cabecera del codificador o el de libopus, 312 muestras)
  const preskip = cab && cab.length >= 12 && String.fromCharCode(...cab.slice(0, 8)) === 'OpusHead' ? cab[10] | (cab[11] << 8) : 312;
  return armarOgg(paquetes, preskip, pcm.length);
}

// ---------------- el contenedor Ogg ----------------
const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; } return t; })();
function crc(b) { let c = 0; for (let i = 0; i < b.length; i++) c = ((c << 8) ^ CRC[((c >>> 24) ^ b[i]) & 255]) >>> 0; return c; }
function pagina(datos, granule, serie, num, tipo) {
  // (la tabla de segmentos: cada paquete en trozos de 255; uno que justo mide 255·k lleva un 0 al final)
  const segs = []; for (const p of datos) { let n = p.length; while (n >= 255) { segs.push(255); n -= 255; } segs.push(n); }
  const cuerpo = datos.reduce((s, p) => s + p.length, 0), h = new Uint8Array(27 + segs.length + cuerpo), v = new DataView(h.buffer);
  h.set([0x4f, 0x67, 0x67, 0x53], 0); h[4] = 0; h[5] = tipo;
  v.setUint32(6, granule % 4294967296, true); v.setUint32(10, Math.floor(granule / 4294967296), true);
  v.setUint32(14, serie, true); v.setUint32(18, num, true); h[26] = segs.length; h.set(segs, 27);
  let o = 27 + segs.length; for (const p of datos) { h.set(p, o); o += p.length; }
  v.setUint32(22, crc(h), true); return h;
}
function armarOgg(paquetes, preskip, muestras) {
  const serie = (Math.random() * 4294967296) >>> 0, pags = [];
  const head = new Uint8Array(19), hv = new DataView(head.buffer);
  head.set([...'OpusHead'].map((c) => c.charCodeAt(0)), 0); head[8] = 1; head[9] = 1; hv.setUint16(10, preskip, true); hv.setUint32(12, SR, true); hv.setInt16(16, 0, true); head[18] = 0;
  const vendor = [...'Stickerazo'].map((c) => c.charCodeAt(0)), tags = new Uint8Array(8 + 4 + vendor.length + 4), tv = new DataView(tags.buffer);
  tags.set([...'OpusTags'].map((c) => c.charCodeAt(0)), 0); tv.setUint32(8, vendor.length, true); tags.set(vendor, 12); tv.setUint32(12 + vendor.length, 0, true);
  pags.push(pagina([head], 0, serie, 0, 2)); pags.push(pagina([tags], 0, serie, 1, 0));
  // (las de audio: hasta 50 paquetes —1 s— por página; el granule es el final de lo que va en la página, más el pre-skip)
  let num = 2, hechas = 0;
  for (let i = 0; i < paquetes.length; i += 50) {
    const grupo = paquetes.slice(i, i + 50); hechas += grupo.length;
    const ultima = i + 50 >= paquetes.length, g = ultima ? preskip + muestras : preskip + hechas * CUADRO;
    pags.push(pagina(grupo, g, serie, num++, ultima ? 4 : 0));
  }
  return new Blob(pags, { type: 'audio/ogg; codecs=opus' });
}
