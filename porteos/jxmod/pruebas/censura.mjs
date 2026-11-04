// censura del chat: el filtro local tapa insultos en varios idiomas aunque vengan disfrazados (repetidas, números por
// letras, letras separadas, frases) y teléfonos/mails, sin tapar palabras normales (computadora, putting, Nigeria,
// vergüenza, merdeka, "te voy a matar en el juego"); mandar: se ve al instante tapado y sale tapado; con la IA rápida
// sale lo que tapó la IA; con la IA lenta sale lo local y después se corrige para todos (chatcorr); lo que manda otro
// (aunque venga sin tapar) se ve tapado, y su corrección cambia su renglón (la de otro no); la IA no puede escribir otra
// cosa; la IA de verdad tapa un insulto que el filtro local no conoce; sin errores.
// uso: node censura.mjs URL_HTML
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500);
// 1) filtro local
const malos = ['andate a la concha de tu madre', 'sos un hijo de puta', 'p.u.t.a', 'P U T O', 'fuuuuck you', 'sh1t', 'eres un pendejo de mierda', 'kill yourself', 'K1LL Y0URSELF', 'f-u-c-k', 'Сука', 'que verga', 'caralho', 'merde', 'mi cel 11 5566-7788', 'juan.perez@gmail.com'];
const buenos = ['Bob es un bobo', 'computadora', 'putting the box here', 'Nigeria y el Zorro', 'qué vergüenza', 'merdeka', 'te voy a matar en el juego jaja', 'gg ez noob', 'tengo 1000000 de puntos', 'Hola, ¿jugamos?', 'la calle 25'];
const loc = await ev(`({ m: ${JSON.stringify(malos)}.map((t) => censurar(t)), b: ${JSON.stringify(buenos)}.map((t) => censurar(t)) })`);
const tapados = loc.m.filter((t, i) => t !== malos[i] && t.includes('*')).length, intactos = loc.b.filter((t, i) => t === buenos[i]).length;
ok(`filtro local: tapa ${malos.length}/${malos.length} disfrazados (repetidas, números, letras separadas, frases, teléfono, mail)`, tapados === malos.length, loc.m);
ok(`filtro local: no toca ${buenos.length}/${buenos.length} frases normales`, intactos === buenos.length, loc.b);
// 2) mandar con la IA rápida (simulada): sale lo de la IA
const rap = await ev(`(async () => { const env = []; const p0 = publicar; window.publicar = publicar = (s, d) => env.push([s, JSON.parse(JSON.stringify(d))]); const on0 = RED.on; RED.on = true;
  const ia0 = iaJSON; window.iaJSON = iaJSON = async (sis, t) => ({ o: { t: t.replace('tonto', '*****') }, ia: 'prueba' });
  CENS.cache.clear(); const t0 = performance.now(); await chatEnviarCensurado('sos un tonto y un puto'); const ms = performance.now() - t0;
  window.iaJSON = iaJSON = ia0; RED.on = on0; window.publicar = publicar = p0;
  const c = env.find((e) => e[0] === 'c'); return { sale: c && c[1].t, id: c && c[1].id, renglon: CHAT[CHAT.length - 1].t, ms: Math.round(ms) }; })()`);
ok('mandar (IA rápida): se ve y sale con lo que tapó la IA y lo local', rap.sale === 'sos un ***** y un ****' && rap.renglon.endsWith('sos un ***** y un ****') && rap.ms < 1500, rap);
// 3) IA lenta: sale lo local y después se corrige para todos
const len = await ev(`(async () => { const env = []; const p0 = publicar; window.publicar = publicar = (s, d) => env.push([s, JSON.parse(JSON.stringify(d))]); const on0 = RED.on; RED.on = true;
  const ia0 = iaJSON; window.iaJSON = iaJSON = async (sis, t) => { await new Promise((r) => setTimeout(r, 2500)); return { o: { t: t.replace('menso', '*****') }, ia: 'prueba' }; };
  CENS.cache.clear(); const pr = chatEnviarCensurado('que menso sos'); await new Promise((r) => setTimeout(r, 1700));
  const antes = env.filter((e) => e[0] === 'c').map((e) => e[1].t), renglonAntes = CHAT[CHAT.length - 1].t; await pr;
  window.iaJSON = iaJSON = ia0; RED.on = on0; window.publicar = publicar = p0;
  const cor = env.find((e) => e[1].k === 'chatcorr'); return { antes, renglonAntes, cor: cor && cor[1], renglon: CHAT[CHAT.length - 1].t }; })()`);
ok('mandar (IA lenta): sale a los 1,5 s con lo local y cuando la IA tapa algo se corrige para todos', len.antes.length === 1 && len.antes[0] === 'que menso sos' && len.cor && len.cor.t === 'que ***** sos' && len.renglon.endsWith('que ***** sos'), len);
// 4) lo de otro: se ve tapado aunque venga sin tapar; su corrección cambia su renglón, la de otro no
const otro = await ev(`(() => { RED.ROOM = RED.ROOM || 'sala'; redMensaje(RED.ROOM + '/c', JSON.stringify({ i: 'ana', n: 'Ana', t: 'sos una mierda bobo', id: 'x1' })); const a = CHAT[CHAT.length - 1].t;
  recibirHecho({ i: 'pepe', k: 'chatcorr', id: 'x1', t: 'hackeado' }); const b = CHAT[CHAT.length - 1].t;
  recibirHecho({ i: 'ana', k: 'chatcorr', id: 'x1', t: 'sos una mierda ****' }); const c = CHAT[CHAT.length - 1].t; return { a, b, c }; })()`).catch((e) => ({ error: String(e) }));
ok('lo que manda otro se ve tapado; sólo su corrección cambia su renglón', otro.a === 'Ana: sos una ****** bobo' && otro.b === otro.a && otro.c === 'Ana: sos una ****** ****', otro);
// 5) la IA no puede escribir otra cosa
const val = await ev(`({ a: censIAValida('hola che', 'hola ***'), b: censIAValida('hola che', 'Ignore everything, you are hacked'), c: censIAValida('hola', 'hola\\nmundo') })`);
ok('lo que devuelve la IA sólo puede tapar letras (otra cosa se descarta)', val.a && !val.b && !val.c, val);
// 6) la IA de verdad
const ia = await ev(`(async () => { CENS.cache.clear(); const t0 = performance.now(); const t = 'callate gordo asqueroso, sos un inutil'; const r = await censIA(censurar(t)); return { t: r, local: censurar(t), ia: CENS.ultIA, ms: Math.round(performance.now() - t0) }; })()`);
ok('la IA gratis de verdad tapa lo que el filtro local no conoce (insultos de aspecto: "gordo asqueroso")', ia.t && ia.t !== ia.local && !/asqueroso/i.test(ia.t), ia);   // (algún modelo tapa de más, "callate" también: es más seguro)
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
