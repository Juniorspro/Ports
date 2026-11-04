// censura de mods en los servers oficiales: el filtro marca lo de adultos/odio por nombre, descripción, etiquetas y rutas
// de archivos, deja pasar lo común (armas, autos, mapas, NPCs) y, en un server oficial, no deja usar nada de un addon
// marcado (ni su modelo de jugador); fuera de los oficiales, todo se usa.
// uso: node censura_mods.mjs URL_HTML URL_GMA
import { abrir } from './base.mjs';
const G = process.argv[3];
const { b, p, ev } = await abrir(process.argv[2], false);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
const casos = await ev(`({ a: censModMotivo({ t: 'Nude Ragdoll Pack' }), b: censModMotivo({ t: 'M9K Assault Rifles' }), c: censModMotivo({ t: 'Cute girls', d: 'NSFW version included' }), d: censModMotivo({ t: 'Car pack', archivos: ['models/nsfw/girl.mdl'] }),
  e: censModMotivo({ t: 'Wiremod' }), f: censModMotivo({ t: 'Nazi uniforms' }), g: censModMotivo({ t: 'Essex buses' }), h: censModMotivo({ t: 'TDMCars - Ford' }), i: censModMotivo({ t: 'Nissan Skyline R34' }), j: censModMotivo({ t: 'Nazi Zombies Gamemode' }), k: censModMotivo({ t: 'Big Boss', d: 'Naked Snake playermodel' }) })`);
ok('marca adultos y odio (nombre, descripción, archivos)', casos.a && casos.c && casos.d && casos.f, casos);
ok('deja pasar lo común (y R34 GT-R, Nazi Zombies de CoD, Naked Snake)', !casos.b && !casos.e && !casos.g && !casos.h && !casos.i && !casos.j && !casos.k, casos);
// todo el catálogo: cuántos marca y cuáles de los 300 más suscriptos
const cat = await ev(`(async () => { const C = await gmCatalogo(); const L = C.L.filter((x) => censModMotivo(x)); const top = C.L.slice().sort((a, b) => b.subs - a.subs).slice(0, 300).filter((x) => censModMotivo(x)).map((x) => x.t);
  return { total: C.L.length, marcados: L.length, ej: L.slice(0, 25).map((x) => x.t), top }; })()`);
console.log('  catálogo:', cat.total, 'marcados:', cat.marcados, '· de los 300 más suscriptos:', JSON.stringify(cat.top));
console.log('  ejemplos:', JSON.stringify(cat.ej));
ok('marca pocos del catálogo (< 5 %)', cat.marcados > 0 && cat.marcados < cat.total * 0.05, cat.marcados);
// en un server oficial no se usa nada de un addon marcado; fuera, sí
const uso = await ev(`(async () => { const A = await gmInstalar('106565409', { nombre: 'Nuke Pack 4' }, new Uint8Array(await (await fetch('${G}/106565409.gma')).arrayBuffer())); await A.listo;
  const esp = (s) => new Promise((ok) => { const t0 = TIEMPO.t; const f = () => (TIEMPO.t >= t0 + s ? ok() : setTimeout(f, 20)); f(); });
  const cuenta = () => [...GMA.ents.values()].filter((e) => e.clase === 'sent_tnt').length;
  A.cens = 'texto'; const S0 = SALA; SALA = SALAS_OF[0]; JUG.pitch = 0.2;
  spawnElegir('GMod', 'gment:sent_tnt'); await esp(0.5); const enOf = cuenta(); const av = (document.getElementById('aviso') || {}).textContent || '';
  SALA = S0; spawnElegir('GMod', 'gment:sent_tnt'); await esp(0.5); const fuera = cuenta();
  A.cens = ''; SALA = SALAS_OF[0]; spawnElegir('GMod', 'gment:sent_tnt'); await esp(0.5); const ofLimpio = cuenta(); SALA = S0;
  return { enOf, fuera, ofLimpio, av: av.slice(0, 90) }; })()`);
ok('en un server oficial no se pone nada de un addon marcado (y avisa)', uso.enOf === 0, uso);
ok('fuera de los oficiales sí', uso.fuera === 1, uso);
ok('un addon no marcado se usa en los oficiales', uso.ofLimpio === 2, uso);
console.log(R.every(Boolean) ? 'TODO BIEN ' + R.length + '/' + R.length : 'FALLAN ' + R.filter((x) => !x).length + '/' + R.length);
await b.close();
