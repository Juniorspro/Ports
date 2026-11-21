// Panel (sugerencia qcqztenm): «Un mejor chat en el juego, siento que le falta algo, que está muy sencillo». El chat
// nuevo: cada mensaje con fondo, el nombre con el color de esa persona, lo tuyo y lo del juego distinguidos, resaltado si
// te nombran; abierto, el historial entero con la hora y para subir; y el globito arriba de la cabeza de quien habla.
// uso: node chat_mejor.mjs URL_HTML [CARPETA]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/chat_mejor'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const celu of [false, true]) {
  const k = celu ? 'celu' : 'pc', { b, p, err, ev } = await abrir(HTML, celu);
  await ev(`PREFS.bienvenida = true; PREFS.nombre = 'Juan'; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForTimeout(2500);
  // (otra persona en la sala, de mentira, a 4 m adelante; y sus mensajes como llegan por la red)
  await ev(`(() => { RED.on = true; RED.ID = RED.ID || 'yo1'; RED.ROOM = RED.ROOM || 'jx/prueba'; const f = CAM.fwd; recibirEstado({ i: 'pedro', n: 'Pedro', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + f.x * 4, JUG.pos.y, JUG.pos.z + f.z * 4], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 0 }); return 1; })()`);
  await p.waitForTimeout(600);
  const llega = (i, n, t) => ev(`redMensaje(RED.ROOM + '/c', ${JSON.stringify(JSON.stringify({ i, n, t }))}); 1`);
  await llega('pedro', 'Pedro', 'hola a todos, quién arma una base?');
  await ev(`chatMostrar('Juan', 'yo! vamos', null, 'yo'); chatMostrar('JXMod', 'Ana entró'); 1`);
  await llega('ana', 'Ana', 'che juan vení para acá');
  await p.waitForTimeout(500);
  const c1 = await p.evaluate(() => { const L = [...document.querySelectorAll('#chat .chL')].map((e) => ({ cls: e.className, txt: e.textContent, nom: (e.querySelector('b') || {}).textContent || '', col: e.querySelector('b') ? e.querySelector('b').style.color : '' }));
    const de = (re) => L.find((x) => re.test(x.txt)) || {}; return { n: L.length, pedro: de(/hola a todos/), yo: de(/yo! vamos/), sis: de(/Ana entró/), ana: de(/che juan/), entro: de(/Pedro entr/) }; });
  await p.screenshot({ path: `${D}/${k}_1_chat.png` });
  ok(`${k}: cada mensaje en su renglón con fondo (y el aviso de que Pedro entró); lo tuyo, lo del juego y el que te nombra, distinguidos`, c1.n === 5 && /\byo\b/.test(c1.yo.cls) && /sis/.test(c1.sis.cls) && /sis/.test(c1.entro.cls) && /menc/.test(c1.ana.cls) && !/menc|sis|yo/.test(c1.pedro.cls), { n: c1.n, pedro: c1.pedro.cls, yo: c1.yo.cls, sis: c1.sis.cls, ana: c1.ana.cls });
  ok(`${k}: el nombre de cada persona con su color (distinto entre Pedro y Ana)`, c1.pedro.col && c1.ana.col && c1.pedro.col !== c1.ana.col, [c1.pedro.col, c1.ana.col]);
  const g = await p.evaluate(() => { const t = document.querySelector('.tagGlobo'); if (!t) return null; const r = t.getBoundingClientRect(), n = t.nextElementSibling.getBoundingClientRect(); return { txt: t.textContent, arriba: r.bottom <= n.top + 1, centrado: Math.abs((r.left + r.right) / 2 - (n.left + n.right) / 2) < 3, visible: r.width > 0 && r.top > 0 }; });
  ok(`${k}: el mensaje de Pedro, en un globito arriba de su nombre (centrados)`, g && /hola a todos/.test(g.txt) && g.arriba && g.centrado && g.visible, g);
  // abierto: el historial con la hora, para subir
  await ev(`for (let i = 1; i <= 30; i++) chatMostrar(i % 2 ? 'Pedro' : 'Ana', 'mensaje número ' + i); abrirChat(); 1`); await p.waitForTimeout(600);
  const c2 = await p.evaluate(() => { const c = document.querySelector('#chat'); return { abierto: c.classList.contains('abierto'), renglones: c.querySelectorAll('.chL').length, horas: c.querySelectorAll('.chH').length, sube: c.scrollHeight > c.clientHeight + 10, abajo: c.scrollTop + c.clientHeight >= c.scrollHeight - 30, ph: document.querySelector('#chatIn').placeholder }; });
  await p.screenshot({ path: `${D}/${k}_2_abierto.png` });
  ok(`${k}: abierto: el historial entero (35) con la hora, se puede subir y arranca abajo; y el cuadro dice qué hacer`, c2.abierto && c2.renglones === 35 && c2.horas === 35 && c2.sube && c2.abajo && /Escribí un mensaje/.test(c2.ph), c2);
  // cerrado: se desvanecen; el globito también se va a los 7 s
  await ev(`document.querySelector('#chatIn').blur(); $('chatIn').classList.add('oc'); UI.abierto = null; 1`); { const t0 = await ev(`TIEMPO.t`); for (let i = 0; i < 300 && (await ev(`TIEMPO.t`)) < t0 + 13; i++) await p.waitForTimeout(100); }
  const c3 = await p.evaluate(() => ({ quedan: [...document.querySelectorAll('#chat .chL')].map((e) => e.textContent), renglones: [...document.querySelectorAll('#chat .chL')].filter((e) => !/se fue|salió|left/i.test(e.textContent)).length, globo: !!document.querySelector('.tagGlobo'), abierto: document.querySelector('#chat').classList.contains('abierto') }));
  ok(`${k}: cerrado, a los 13 s de juego ya no queda nada en pantalla de antes (sólo, si hay, el aviso de que Pedro se fue), ni el globito`, c3.renglones === 0 && !c3.globo && !c3.abierto, c3);
  const js = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|Failed to fetch/i.test(x));
  ok(`${k}: sin errores de JS`, !js.length, js.slice(0, 4));
  await b.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
