// Sin carteles de «moriste» (Discord: «Quiten los carteles de "moriste" o parecidos»): como en GMod, al morir se ve el
// muñeco y se reaparece, sin texto encima.
//  1. al morir no sale ningún cartel (el aviso del medio queda escondido o con otra cosa) y hay muñeco;
//  2. se reaparece solo (a los 3 s, como antes) y tampoco sale cartel;
//  3. ni «Te moriste», ni «¡Te caíste!» (al caerse de la moto), ni «Disparar o saltar para reaparecer» (con un modo de
//     juego de GMod) quedan en el juego;
//  4. sin errores de JS.
// uso: node sin_carteles_muerte.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, ev, err } = await abrir(HTML + '?test', false);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(3000);   // (que se vaya el cartel con el nombre del mapa)
// (todo lo que muestre el aviso del medio desde que se muere)
await ev(`(() => { window.__avisos = []; const a = $('aviso'); new MutationObserver(() => { if (a.classList.contains('ve') && a.textContent) window.__avisos.push(a.textContent); }).observe(a, { attributes: true, childList: true, characterData: true, subtree: true }); return 1; })()`);
await ev(`(() => { if (typeof danarJugador === 'function') danarJugador(500, v3(0, 0, 1)); else morirJugador(); return 1; })()`);
await p.waitForTimeout(700);
const muerto = await ev(`({ vivo: JUG.vivo, aviso: $('aviso').classList.contains('ve') ? $('aviso').textContent : '', muneco: !!(JUG.cuerpo && (JUG.cuerpo.rag || JUG.cuerpo.muneco)) || PERS.some((q) => q.rag && q.esJugador) })`);
// (puede quedar a la vista un aviso de antes, que no tiene que ver: lo que cuenta es que al morir no aparezca ninguno)
const MUERTE = /mor[ií]|muert|died|dead|ca[ií]ste|reaparec|respawn/i;
ok('1. al morir no sale ningún cartel y se ve el muñeco', muerto.vivo === false && !MUERTE.test(muerto.aviso) && muerto.muneco, muerto);
await p.waitForTimeout(3600);
const vuelta = await ev(`({ vivo: JUG.vivo, avisos: window.__avisos })`);
ok('2. se reaparece solo y no sale ningún cartel en todo el rato', vuelta.vivo === true && !vuelta.avisos.length, vuelta);
const textos = await ev(`(() => { const f = [typeof morirJugador === 'function' && morirJugador, typeof autoPaso === 'function' && autoPaso, typeof gmaPaso === 'function' && gmaPaso].filter(Boolean).map(String).join(''); return { moriste: /aviso[(][^)]*Te moriste/.test(f), caiste: /aviso[(][^)]*Te caíste/.test(f), reaparecer: T('gm.reaparecer') !== 'gm.reaparecer' || /gm[.]reaparecer/.test(f), avisoAlMorir: /aviso[(]/.test(String(morirJugador)) }; })()`);
ok('3. ni «Te moriste», ni «¡Te caíste!», ni «Disparar o saltar para reaparecer» quedan en el juego', !textos.moriste && !textos.caiste && !textos.reaparecer && !textos.avisoAlMorir, textos);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('4. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
