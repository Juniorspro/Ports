// paquetes aparte (?perezoso: sin bajarlos de entrada): al arrancar no hay ninguno; elegir un personaje y entrar lo baja
// antes de empezar (y se juega con él, no con el Hero); el personaje de otro jugador primero es el Hero y cambia solo
// cuando llega su paquete (aunque no mande nada nuevo); un mapa grande se baja al entrar, con sus texturas; uno que no
// está no rompe nada (queda el Hero y se reintenta); sin errores.
// uso: node paquetes.mjs URL_DEL_HTML (servido por http, con la carpeta rb/ al lado)
import { abrir } from './base.mjs';
const U = process.argv[2] + (process.argv[2].includes('?') ? '&' : '?') + 'perezoso';
const { b, p, err, ev } = await abrir(U);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const ini = await ev(`({ n: Object.keys(DATA.rbp || {}).length, listos: Object.keys(RBP.est).length, bins: Object.keys(RBP.bins).length, mallas: DATA.ms.filter((m) => m.k).length, tex: DATA.tx.filter((t) => t.k).length })`);
ok('al arrancar: hay paquetes aparte y no se bajó ninguno', ini.n > 40 && ini.listos === 0 && ini.bins === 0 && ini.mallas > 100 && ini.tex > 50, ini);
// elegir a Bon y entrar: se baja antes y se juega con Bon
const t0 = Date.now();
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); PREFS.skin = 'Bon'; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.cuerpo`), null, { timeout: 30000 });
const yo = await ev(`({ skin: JUG.cuerpo.skin, quiere: JUG.cuerpo.skinQuiere, listo: rbListo('s_Bon'), est: RBP.est })`);
ok('elegido Bon: se baja antes de empezar y se juega con Bon (no con el Hero)', yo.skin === 'Bon' && !yo.quiere && yo.listo, { ...yo, ms: Date.now() - t0 });
await ev(`JUG.tercera = true; 1`); await p.waitForTimeout(1500);   // (en primera persona el cuerpo no se dibuja)
const tx = await ev(`(() => { const P = JUG.cuerpo; let tot = 0, listas = 0; for (const x of P.md.A) for (const mi of x.mt || []) { const t = DATA.mt[mi] && DATA.mt[mi].t; if (t === undefined || t < 0) continue; tot++; if (R.tex[t] && R.tex[t].gl && R.tex[t].gl !== R.texGris) listas++; } return { tot, listas }; })()`);
ok('sus texturas (del paquete) se cargaron', tx.tot > 0 && tx.listas === tx.tot, tx);
// otro jugador con Sha: primero el Hero, después Sha solo (sin otro mensaje)
const rem = await ev(`(async () => { recibirEstado({ i: 'otro', n: 'Ana', k: 'Sha', h: 'HatEmpty', p: [JUG.pos.x + 3, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 0 });
  const R2 = RED.remotos.get('otro'), antes = R2.P.skin; await rbAsegurar('s_Sha'); await new Promise((r) => setTimeout(r, 100)); return { antes, despues: RED.remotos.get('otro').P.skin, pers: PERS.filter((P) => P.remoto === 'otro').length }; })()`);
ok('el personaje de otro jugador: Hero mientras baja, Sha cuando llega (un solo cuerpo)', rem.antes === 'Hero' && rem.despues === 'Sha' && rem.pers === 1, rem);
// un mapa grande
await ev(`empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'RB_Construct' && JUEGO.estado === 'juego'`), null, { timeout: 30000 });
await p.waitForTimeout(2500);
const mapa = await ev(`({ listo: rbListo('m_RB_Construct'), tri: (MUNDO.triSup || []).length, texMapa: Object.keys(PK.extra).length, suelo: JUG.suelo || Math.abs(JUG.vel.y) < 0.5 })`);
ok('gm_construct: se baja al entrar (mallas, choques y texturas) y se puede pisar', mapa.listo && mapa.tri > 1000 && mapa.texMapa > 20 && mapa.suelo, mapa);
await p.screenshot({ path: '/tmp/claude-0/ah/paquetes_construct.png' });
// la pizzería: el mapa, los animatrónicos (personajes y los de la noche) y sus sonidos
await ev(`empezarPartida('RB_Pizzeria'); 1`);
await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'RB_Pizzeria' && JUEGO.estado === 'juego'`), null, { timeout: 60000 });
const piz = await ev(`({ listo: ['m_RB_Pizzeria', 's_Freddy', 's_Bonnie', 's_Chica', 's_Foxy'].every(rbListo), son: ['fn_6am', 'fn_llamada1_es', 'fn_ventilador'].map((n) => !!PK.parte('a:' + n)), anim: (() => { try { const A = nocheAnimCrear('F'); return A.md.A.filter((x) => x.m !== undefined && DATA.ms[x.m]).every((x) => !!binDe(DATA.ms[x.m])); } catch (e) { return String(e); } })() })`);
ok('la pizzería: se bajan el mapa, los 4 animatrónicos y sus sonidos (llamadas, 6 AM)', piz.listo && piz.son[0] && piz.son[1] && piz.anim === true, piz);
// uno que no está: no rompe, queda el Hero
const falla = await ev(`(async () => { DATA.rbp.s_Ninja[0] = 'no_existe.rbp'; const r = await rbAsegurar('s_Ninja'); const P = crearPersona('Ninja', 'HatEmpty', { nombre: '' }); const s = P.skin; borrarPersona(P); return { r, s, listo: rbListo('s_Ninja') }; })()`);
ok('un paquete que no está: no rompe nada, queda el Hero', falla.r === false && falla.s === 'Hero' && !falla.listo, falla);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
