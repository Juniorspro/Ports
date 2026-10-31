// pad de memes: el botón del celular (o la I) abre el pad con los 36; tocar uno lo hace sonar (decodificado recién ahí, no
// al cargar), aparece en el chat con su color y no se repite antes de 0,8 s; el de otro jugador suena en su lugar (3D) y
// sale en el chat con su nombre, y se puede silenciar (el chat sigue); "Mis memes": un audio del aparato se guarda, uno
// largo no; en la sala el audio propio viaja de a pedazos y del otro lado suena cuando termina de llegar; sin errores.
// uso: node memes.mjs HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML, true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(2500);
await p.touchscreen.tap(5, 5); await p.waitForTimeout(400);   // (el primer toque prende el modo táctil y el audio)
const ini = await ev(`({ son: DATA.son.filter((n) => /^MM_/.test(n)).length, buf: Object.keys(AUD.buf).filter((n) => /^MM_/.test(n)).length, memes: (DATA.memes || []).length, partes: DATA.memes.every(([k]) => !!PK.parte('a:MM_' + k)) })`);
ok('36 memes en el paquete, ninguno decodificado al cargar (no están en la lista de sonidos de entrada)', ini.memes === 36 && ini.partes && ini.son === 0 && ini.buf === 0, ini);
// el botón del celular
const bt = await ev(`(() => { const e = document.querySelector('[data-btn=memes]'), r = e.getBoundingClientRect(); return { ver: r.width > 20 && getComputedStyle(e).display !== 'none', r: [r.left + r.width / 2, r.top + r.height / 2], chat: (() => { const c = document.querySelector('[data-btn=chat]').getBoundingClientRect(); return [c.left, c.top, c.width]; })(), x: [r.left, r.top, r.width] }; })()`);
await p.touchscreen.tap(bt.r[0], bt.r[1]); await p.waitForTimeout(500);
const pan = await ev(`(() => { const p = $('memePan'), c = p.querySelector('.caja').getBoundingClientRect(); return { ui: UI.abierto, vis: !p.classList.contains('oc'), n: p.querySelectorAll('.mmB').length, dentro: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight }; })()`);
ok('en el celular el botón está al lado del chat (misma fila) y abre el pad con los 36, entero en la pantalla', bt.ver && Math.abs(bt.x[1] - bt.chat[1]) < 2 && bt.x[0] > bt.chat[0] + bt.chat[2] && pan.ui === 'memes' && pan.vis && pan.n === 36 && pan.dentro, { bt, pan });
await p.screenshot({ path: D + 'memes_pad_celu.png' });
// tocar uno: suena, al chat, no se repite enseguida
await ev(`window.__son = []; const f0 = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () { window.__son.push(this.buffer && +this.buffer.duration.toFixed(2)); return f0.apply(this, arguments); };
  const g0 = fuente3D; fuente3D = function () { window.__3d = (window.__3d || 0) + 1; return g0.apply(this, arguments); }; 1`);
const [vx, vy] = await ev(`(() => { const r = document.querySelector('#memePan .mmB[data-id="rb:vineboom"] .mmBot').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await p.touchscreen.tap(vx, vy); await p.waitForTimeout(500);
const t1 = await ev(`({ son: window.__son.slice(), chat: $('chat').innerHTML, dec: [...MEME.dec.keys()], brilla: document.querySelector('#memePan .mmB[data-id="rb:vineboom"]').classList.contains('suena') })`);
ok('tocar "Vine boom": suena (1,2 s) y sale en el chat con su botoncito', t1.son.some((d) => Math.abs(d - 1.2) < 0.06) && /chMm/.test(t1.chat) && /Vine boom/.test(t1.chat) && t1.brilla, t1);
ok('sólo se decodificó el que se tocó', t1.dec.length === 1 && t1.dec[0] === 'rb:vineboom', t1.dec);
const rep = await ev(`(async () => { const a = await memeTocar('rb:bruh'); await new Promise((r) => setTimeout(r, 900)); const b = await memeTocar('rb:bruh'); return [a, b]; })()`);
ok('enseguida no se repite (0,8 s) y después sí', rep[0] === false && rep[1] === true, rep);
await p.screenshot({ path: D + 'memes_tocado.png' });
// otro jugador
const otro = await ev(`(async () => { recibirEstado({ i: 'otro', n: 'Lucas', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 6, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 0 });
  window.__son.length = 0; window.__3d = 0; memeRed({ k: 'meme', m: 'rb:oof', i: 'otro', q: 'Lucas' }); await new Promise((r) => setTimeout(r, 600));
  const a = { son: window.__son.slice(), d3: window.__3d, chat: CHAT[CHAT.length - 1].t };
  PREFS.memesOtros = false; window.__son.length = 0; memeRed({ k: 'meme', m: 'rb:wow', i: 'otro2', q: 'Ana' }); await new Promise((r) => setTimeout(r, 600));
  const b = { son: window.__son.length, chat: CHAT[CHAT.length - 1].t }; PREFS.memesOtros = true;
  memeRed({ k: 'meme', m: 'rb:<img>', i: 'otro3' }); memeRed({ k: 'meme', m: 'rb:noexiste', i: 'otro4' });
  return { a, b, ult: CHAT[CHAT.length - 1].t }; })()`);
ok('el de otro jugador suena en su lugar (3D) y sale con su nombre', otro.a.son.length === 1 && otro.a.d3 >= 1 && otro.a.chat === 'Lucas: Oof', otro.a);
ok('silenciados los de los demás: no suena pero sale en el chat; uno que no existe ni sale', otro.b.son === 0 && otro.b.chat === 'Ana: Wow' && otro.ult === 'Ana: Wow', otro);
// mis memes: un audio de 1 s (WAV hecho acá) y uno de 9 s
const WAV = `(s) => { const sr = 22050, n = Math.round(sr * s), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / sr * 2 * Math.PI * (300 + i / n * 600)) * 12000, true); return b; }`;
const mio = await ev(`(async () => { const wav = ${WAV}; const m = await memeImportar('Mi grito.wav', wav(1)), largo = await memeImportar('Largo.wav', wav(9));
  MEME.tab = 'mios'; await memePanDibujar(); const L = [...document.querySelectorAll('#memePan .mmB .mmN')].map((x) => x.textContent);
  return { id: m.id, n: m.n, largo: largo.error, L }; })()`);
ok('"Mis memes": el audio de 1 s queda guardado con su nombre; uno de 9 s no', /^u:[0-9a-f]{12}$/.test(mio.id) && mio.n === 'Mi grito' && mio.L.includes('Mi grito') && mio.largo === 'mm.largo', mio);
await p.screenshot({ path: D + 'memes_mios.png' });
// en la sala: lo que mando (pedazos + aviso) y, del otro lado, suena cuando termina de llegar
const sala = await ev(`(async () => {
  const env = []; const on0 = RED.on, cli0 = RED.cli; RED.on = true; RED.cli = { publish: (t, s) => env.push(JSON.parse(s)) };
  await new Promise((r) => setTimeout(r, 900)); window.__son.length = 0; await memeTocar('${mio.id}'); await new Promise((r) => setTimeout(r, 1500));
  RED.on = on0; RED.cli = cli0;
  const aviso = env.find((x) => x.k === 'meme'), pz = env.filter((x) => x.k === 'memed');
  // del otro lado: no lo tiene; llega el aviso antes que el audio
  const orig = (await memeMios()).find((x) => x.id === '${mio.id}'); await memeBorrar('${mio.id}'); MEME.dec.delete('${mio.id}'); MEME.sala.delete('${mio.id}');
  window.__son.length = 0; memeRed({ ...aviso, i: 'otro5' }); const antes = window.__son.length;
  for (const x of pz.reverse()) memeRed({ ...x, i: 'otro5' }); await new Promise((r) => setTimeout(r, 800));
  const llego = MEME.sala.get('${mio.id}'), igual = !!llego && llego.a.byteLength === orig.a.byteLength && new Uint8Array(llego.a).every((v, i) => v === new Uint8Array(orig.a)[i]);
  return { aviso: aviso && { m: aviso.m, n: aviso.n, q: aviso.q }, pedazos: pz.length, antes, despues: window.__son.slice(), igual, chat: CHAT[CHAT.length - 1].t }; })()`);
ok('en la sala: manda el aviso y el audio de a pedazos (una sola vez); del otro lado suena al terminar de llegar, igual', sala.aviso && sala.aviso.n === 'Mi grito' && sala.pedazos >= 2 && sala.antes === 0 && sala.despues.length === 1 && Math.abs(sala.despues[0] - 1) < 0.05 && sala.igual, sala);
// la I en la compu
await ev(`cerrarPaneles(); ENT.pulsos.push('memes'); atenderPulsos(); 1`); const conI = await ev(`UI.abierto`); await ev(`ENT.pulsos.push('memes'); atenderPulsos(); 1`);
ok('la I (pulso "memes") abre y cierra el pad', conI === 'memes' && await ev(`UI.abierto`) === null, conI);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
