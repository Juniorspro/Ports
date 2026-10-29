// el sonido de la emisora sale de la radio: se mide lo que sale por cada oído (izquierdo y derecho) con una música de
// prueba hecha acá (estéreo tirada toda a la izquierda, a propósito: si la radio no la pasa a mono, se oye siempre a la
// izquierda), y también la distancia, de atrás de la radio, el sonido de parlante chico y la estática al sintonizar.
// uso: node radio_espacial.mjs Hypper.html carpeta
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML, false);
const espera = (ms) => p.waitForTimeout(ms), ok = (c, t, x) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + x : ''));
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.vol = 100; PREFS.mods = {radio:true}; inicioMostrar(false); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; empezarPartida('FlatGrass')`);
await espera(4000);
// la música de prueba: tonos de 60, 250, 1000, 3000 y 10000 Hz más ruido, sólo en el canal izquierdo
await ev(`(() => { const sr = 44100, n = sr * 14, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf); const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  let r = 0; for (let i = 0; i < n; i++) { const t = i / sr; r = r * 0.6 + (Math.random() * 2 - 1) * 0.4; let x = 0.03 * r; for (const f of [60, 250, 1000, 3000, 10000]) x += 0.11 * Math.sin(2 * Math.PI * f * t); v.setInt16(44 + i * 4, Math.round(x * 32000), true); v.setInt16(46 + i * 4, 0, true); }
  window.__wav = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); return 1; })()`);
// la radio, quieta en el piso, con los parlantes mirando a -Z
await ev(`(() => { audioIniciar(); entidadPonerMod('radio', true); const e = radioMia(); e.b.pos.set(20, 1.2, 20); e.b.q.copy(new Quat()); e.b.vel.set(0,0,0); e.b.frozen = true; e.b.updateWorld(); e.prm.r = 40; e.prm.vol = 1;
  const id = '00000000-0000-4000-8000-000000000000'; EST.url.set(id, window.__wav); radioPoner(e, 'rb:' + id, 0, 'prueba', false); return 1; })()`);
// lo que sale por cada oído (después del volumen general)
await ev(`(() => { const c = AUD.ctx, sp = c.createChannelSplitter(2); AUD.master.connect(sp); window.__an = [0, 1].map((i) => { const a = c.createAnalyser(); a.fftSize = 8192; a.smoothingTimeConstant = 0; sp.connect(a, i); return a; }); return 1; })()`);

for (let i = 0; i < 15; i++) { await espera(500); if (await ev(`(() => { const S = EST.son.get(radioMia()); return !!(S && S.listo && S.a.currentTime > 0.5); })()`)) break; }
const suena = JSON.parse(await ev(`(() => { const S = EST.son.get(radioMia()); return JSON.stringify(S ? { listo: S.listo, t: +S.a.currentTime.toFixed(1), err: S.a.error && S.a.error.code } : null); })()`));
ok(suena && suena.listo, 'la música de prueba suena por la radio', JSON.stringify(suena));
// pone la cámara (el oído) en un punto, mirando a la radio o para otro lado, espera y mide
const medir = (x, y, z, mirar) => ev(`(async () => { const e = radioMia(), c = v3(${x}, ${y}, ${z}), d = ${mirar}; DBG.cam = { p: c, q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y, -1, 1))) };
  await new Promise((r) => setTimeout(r, 1200)); const L = window.__an[0], R = window.__an[1], a = new Float32Array(L.fftSize), bb = new Float32Array(R.fftSize); let sl = 0, sr = 0;
  for (let k = 0; k < 8; k++) { L.getFloatTimeDomainData(a); R.getFloatTimeDomainData(bb); for (let i = 0; i < a.length; i++) { sl += a[i] * a[i]; sr += bb[i] * bb[i]; } await new Promise((r) => setTimeout(r, 90)); }
  const fq = new Float32Array(L.frequencyBinCount); L.getFloatFrequencyData(fq); const bin = (f) => { let m = -200; const i0 = Math.round(f / (AUD.ctx.sampleRate / L.fftSize)); for (let i = i0 - 2; i <= i0 + 2; i++) m = Math.max(m, fq[i]); return +m.toFixed(1); };
  let mejor = -1e9, lag = 0; for (let k = -48; k <= 48; k++) { let c = 0; for (let i = 60; i < a.length - 60; i++) c += a[i] * bb[i + k]; if (c > mejor) { mejor = c; lag = k; } }
  const n = 8 * a.length; return JSON.stringify({ itd: +(lag / AUD.ctx.sampleRate * 1000).toFixed(2), L: 10 * Math.log10(sl / n + 1e-12), R: 10 * Math.log10(sr / n + 1e-12), f60: bin(60), f250: bin(250), f1k: bin(1000), f3k: bin(3000), f10k: bin(10000) }); })()`).then(JSON.parse);
const r1 = (v) => Math.round(v * 10) / 10;
// 1) de qué lado se oye: la radio a la derecha, después a la izquierda (a 5 m, mirando a +Z)
const der = await ev(`JSON.stringify([CAM.der.x, CAM.der.y, CAM.der.z].map((v) => +v.toFixed(3)))`);
const enDer = await medir(15, 1.2, 20, 'v3(0, 0, 1)'); // (la radio queda en +X)
const derOk = await ev(`(() => { DBG.cam = { p: v3(15, 1.2, 20), q: Quat.euler(0, 0) }; camaraActualizar(0.016); return CAM.der.x > 0.9; })()`);
const enIzq = await medir(25, 1.2, 20, 'v3(0, 0, 1)'); // (la radio queda en -X)
console.log('derecha de la pantalla:', der, derOk ? '(+X: la radio está a la derecha)' : '(-X: al revés)');
const dD = enDer.R - enDer.L, dI = enIzq.L - enIzq.R;
// (a 90°, en la realidad, un oído oye 4-10 dB más que el otro y le llega ~0,6 ms antes; el retraso es positivo si el derecho va atrás)
const [aDer, aIzq] = derOk ? [enDer, enIzq] : [enIzq, enDer];
ok(aDer.R - aDer.L > 4 && aDer.itd < -0.3, 'radio a la derecha → más fuerte y antes en el oído derecho', `R-L = ${r1(aDer.R - aDer.L)} dB · el izquierdo ${-aDer.itd} ms después`);
ok(aIzq.L - aIzq.R > 4 && aIzq.itd > 0.3, 'radio a la izquierda → más fuerte y antes en el oído izquierdo', `L-R = ${r1(aIzq.L - aIzq.R)} dB · el derecho ${aIzq.itd} ms después`);
// 2) la distancia: de frente a los parlantes (están en -Z), a 3, 6, 12 y 24 m y pasando el alcance (40 m)
const dist = [];
for (const dz of [3, 6, 12, 24, 41]) { const m = await medir(20, 1.2, 20 - dz, 'v3(0, 0, 1)'); dist.push([dz, 10 * Math.log10((Math.pow(10, m.L / 10) + Math.pow(10, m.R / 10)) / 2)]); }
console.log('nivel por distancia:', dist.map(([d, v]) => `${d} m ${r1(v)} dB`).join(' · '));
const caidas = [1, 2, 3].map((i) => dist[i - 1][1] - dist[i][1]);
ok(caidas.every((c) => c > 3.5 && c < 8.5), 'cada vez que se duplica la distancia baja unos 6 dB (como en la realidad)', caidas.map(r1).join(' / ') + ' dB');
ok(dist[4][1] < dist[0][1] - 45, 'pasando el alcance no se oye', `${r1(dist[0][1] - dist[4][1])} dB menos que a 3 m`);
// 3) de atrás de la radio (los parlantes miran para el otro lado) se oye más bajo
const frente = await medir(20, 1.2, 14, 'v3(0, 0, 1)'), atras = await medir(20, 1.2, 26, 'v3(0, 0, -1)');
const nv = (m) => 10 * Math.log10((Math.pow(10, m.L / 10) + Math.pow(10, m.R / 10)) / 2);
ok(nv(frente) - nv(atras) > 4, 'de atrás de la radio suena más bajo que de frente', `${r1(nv(frente) - nv(atras))} dB`);
// 4) sonido de parlante chico: sin graves ni agudos (los tonos entran todos iguales)
const viejo = await ev(`!EST.son.get(radioMia()).C`); if (viejo) { console.log('(versión sin la cadena de radio: no se miden tonos ni estática)'); await b.close(); process.exit(0); }
const s = await ev(`(async () => { const S = EST.son.get(radioMia()), A = AUD.ctx.createAnalyser(); A.fftSize = 8192; A.smoothingTimeConstant = 0; S.C.sal.connect(A); await new Promise((r) => setTimeout(r, 400));
  const fq = new Float32Array(A.frequencyBinCount); A.getFloatFrequencyData(fq); S.C.sal.disconnect(A); const bin = (f) => { let m = -200; const i0 = Math.round(f / (AUD.ctx.sampleRate / A.fftSize)); for (let i = i0 - 2; i <= i0 + 2; i++) m = Math.max(m, fq[i]); return +m.toFixed(1); };
  return JSON.stringify({ f60: bin(60), f250: bin(250), f1k: bin(1000), f3k: bin(3000), f10k: bin(10000) }); })()`).then(JSON.parse);
console.log('tonos (dB):', JSON.stringify({ '60': s.f60, '250': s.f250, '1k': s.f1k, '3k': s.f3k, '10k': s.f10k }));
ok(s.f1k - s.f60 > 20, 'los graves (60 Hz) bajan mucho', `${r1(s.f1k - s.f60)} dB bajo 1 kHz`);
ok(s.f1k - s.f10k > 15, 'los agudos (10 kHz) bajan mucho', `${r1(s.f1k - s.f10k)} dB bajo 1 kHz`);
ok(s.f1k > s.f250 + 3 && s.f3k > s.f250 + 3, 'los medios (1-3 kHz) quedan adelante', `1 kHz ${s.f1k} · 3 kHz ${s.f3k} · 250 Hz ${s.f250}`);
// (la estática mientras sintoniza: como si se cortara un momento la emisora; las de verdad tardan 1-3 s en arrancar)
const estatica = await ev(`(async () => { const S = EST.son.get(radioMia()); S.listo = false; await new Promise((r) => setTimeout(r, 700)); const v = S.C.ruido.gain.value; S.listo = true; return JSON.stringify({ ruido: +v.toFixed(3) }); })()`);
await espera(1500);
const e0 = JSON.parse(estatica);
const sis = Number(await ev(`EST.son.get(radioMia()).C.ruido.gain.value.toFixed(3)`));
ok(e0.ruido >= 0.05, 'mientras sintoniza suena estática', estatica);
ok(sis > 0 && sis < 0.03, 'sonando: queda un siseo bajito', String(sis));
await ev(`DBG.cam = null; 1`);
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|Failed to load resource|favicon/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close(); process.exit(0);
