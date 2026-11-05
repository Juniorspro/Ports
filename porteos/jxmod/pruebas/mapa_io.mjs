// Lo que pasa en los mapas de Source (Discord: «Liminal Hotel: ¿hay manera de usar el tocadiscos?»). En
// gm_liminal_hotel el tocadiscos es un botón de dos posiciones: al apretarlo el disco gira (func_rotating «rotatedisc», con
// el disco pegado) y a los 2 s suena la música del mapa («drifting», un mp3 de su pak); al apretarlo otra vez, se para.
//  1. el tocadiscos está y se puede apretar: mirándolo aparece «E: apretar el botón»;
//  2. con E: el disco empieza a girar (el disco pegado también) y a los 2 s suena la música (la del mapa, decodificada);
//  3. con E otra vez: la música se corta y el disco se frena hasta quedar quieto;
//  4. los sonidos de ambiente del mapa que se repiten (zumbidos, ambiente) suenan cerca de donde están y no lejos;
//  5. en una sala: apretarlo avisa a los demás ('mio') y lo que llega de otro lo prende igual;
//  6. sin errores de JS.
// uso: node mapa_io.mjs URL_HTML URL_CARPETA_GMA
import { abrir } from './base.mjs';
const [, , HTML, CARP] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/2556466049.gma')).arrayBuffer()); const A = await gmInstalar('2556466049', { nombre: '2556466049', sinDeps: true }, b); await A.listo; return 1; })()`);
await ev(`empezarPartida('WS_gm_liminal_hotel'); 1`);
await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'WS_gm_liminal_hotel' && JUEGO.estado === 'juego'`), null, { timeout: 300000 }).catch(() => {});
await p.waitForTimeout(3000);
await ev(`cerrarPaneles && cerrarPaneles(); window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); });
  window.__son = []; const s0 = sonar; sonar = function (n, pos, v, t) { window.__son.push([n, TIEMPO.t]); return s0.apply(this, arguments) || { stop() { window.__son.push(['stop:' + n, TIEMPO.t]); } }; };
  window.__pub = []; publicar = (c, d) => { window.__pub.push(d); }; 1`);
// el botón del tocadiscos: el que prende «rotatedisc»
const c1 = await ev(`(async () => {
  const b = PUERTAS.bot.find((x) => x.sal.i.some((o) => o[0] === 'rotatedisc')); if (!b) return { sinBoton: true, botones: PUERTAS.bot.length };
  const c = b.lo.clone().add(b.hi).scale(0.5);
  // (pararse a 1,2 m del botón, del lado libre, y mirarlo)
  let lugar = null; for (let a = 0; a < 16 && !lugar; a++) { const d = v3(Math.sin(a * Math.PI / 8), 0, Math.cos(a * Math.PI / 8)), q = c.clone().addS(d, 1.2); const h = mundoRayo(c.clone().addS(d, 0.25), d, 1.0); if (h) continue; const piso = mundoRayo(q, v3(0, -1, 0), 3); if (piso) lugar = v3(q.x, q.y - piso.t + 0.05, q.z); }
  if (!lugar) return { sinLugar: true };
  JUG.noclip = false; JUG.pos.copy(lugar); JUG.vel.set(0, 0, 0); JUG.tercera = false; await esperaJuego(0.3);
  const o = JUG.ojoPos || CAM.pos, d = vsub(c, o); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); await esperaJuego(0.3);
  window.__bot = b; window.__disco = PUERTAS.l.find((D) => D.P.rot && D.P.nombre.toLowerCase() === 'rotatedisc'); window.__mus = MIO.snd.find((s) => s.n === 'drifting');
  return { texto: puertaApunta(), disco: !!__disco, hijos: __disco ? __disco.md.A.length : 0, musica: __mus && { nom: mioNom(__mus), buf: !!(AUD.buf && AUD.buf[mioNom(__mus)]) || !!audioBuf(mioNom(__mus)) } };
})()`);
ok('1. el tocadiscos está y se puede apretar («E: apretar el botón»)', !c1.sinBoton && !c1.sinLugar && /apretar/i.test(c1.texto || '') && c1.disco && c1.hijos >= 2, c1);
const c2 = await ev(`(async () => {
  const a0 = __disco.ang, t0 = TIEMPO.t; puertaUsar(); await esperaJuego(0.8);
  const gira = __disco.on && Math.abs(__disco.ang - a0) > 1; const antes = __son.filter((x) => /drifting/i.test(x[0])).length; await esperaJuego(2.0);
  const sono = __son.find((x) => /drifting/i.test(x[0]) && !/^stop/.test(x[0]));
  // (el disco pegado gira con él: su giro en el mundo cambia)
  return { gira, ang: +__disco.ang.toFixed(1), sonoTras: sono ? +(sono[1] - t0).toFixed(2) : null, antesDe2s: antes, publico: __pub.filter((d) => d.k === 'mio').length };
})()`);
ok('2. con E el disco gira y a los 2 s suena la música del mapa', c2.gira && c2.sonoTras !== null && c2.sonoTras >= 1.9 && c2.sonoTras < 2.6 && c2.antesDe2s === 0, c2);
const c3 = await ev(`(async () => { puertaUsar(); await esperaJuego(2.5); return { corto: __son.some((x) => /^stop:.*drifting/i.test(x[0])) || !__mus.fuente, on: __disco.on, vel: +__disco.velAct.toFixed(2) }; })()`);
ok('3. con E otra vez la música se corta y el disco queda quieto', c3.corto && !c3.on && c3.vel < 0.01, c3);
const c4 = await ev(`(async () => {
  const L = MIO.snd.filter((s) => s.on && s.bucle && mioNom(s)); if (!L.length) return { sinAmbiente: true, total: MIO.snd.length };
  const s = L[0]; JUG.noclip = true; JUG.pos.copy(s.pos).add(v3(0.5, 0, 0)); await esperaJuego(0.5);
  const cerca = [...AUD.loops.keys()].filter((k) => k.startsWith('mio')).length; const ctx = !!AUD.ctx;
  JUG.pos.copy(s.pos).add(v3(s.r + 30, 0, 0)); await esperaJuego(0.5);
  const lejos = [...AUD.loops.keys()].filter((k) => k === 'mio' + s.i).length; JUG.noclip = false;
  return { ambientes: L.length, ej: s.s, cerca, lejos, ctx };
})()`);
ok('4. los sonidos de ambiente que se repiten suenan cerca y no lejos', !c4.sinAmbiente && (c4.ctx ? c4.cerca >= 1 && c4.lejos === 0 : true) && c4.ambientes >= 10, c4);
const c5 = await ev(`(async () => {
  const i = PUERTAS.bot.indexOf(__bot), red0 = RED.on; RED.on = true;
  mioBoton(__bot, true); await esperaJuego(0.3); mioBoton(__bot, true); await esperaJuego(0.3);
  const n = __pub.filter((d) => d.k === 'mio').length;
  mioRed({ k: 'mio', b: i }); await esperaJuego(0.6); const on = __disco.on; mioRed({ k: 'mio', b: i }); await esperaJuego(0.3);
  RED.on = red0;
  return { avisos: n, conIndice: __pub.filter((d) => d.k === 'mio').every((d) => d.b === i), remotoPrende: on, remotoApaga: !__disco.on, nuevosAvisos: __pub.filter((d) => d.k === 'mio').length - n };
})()`);
ok('5. en una sala: avisa a los demás y lo que llega de otro lo prende y lo apaga', c5.avisos === 2 && c5.conIndice && c5.remotoPrende && c5.remotoApaga && c5.nuevosAvisos === 0, c5);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|AudioContext/i.test(x));
ok('6. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
