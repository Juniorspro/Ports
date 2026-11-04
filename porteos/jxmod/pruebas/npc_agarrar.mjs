// agarrar un NPC vivo con la Physics Gun: se hace muñeco de trapo (no la animación de saltar), se lo lleva de donde se lo
// agarró, al soltarlo cae y cuando queda quieto se levanta solo y sigue vivo. Se cuentan los sonidos que suenan mientras
// se lo tiene agarrado (el "error de audio": sonidos repetidos sin parar). Con URL_GMA, también un NPC con el modelo de
// un addon (el Iron Man, Workshop 158326196, puesto como NPC). uso: node npc_agarrar.mjs URL_HTML [URL_GMA]
import { abrir } from './base.mjs';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(process.argv[2]);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500);
const prueba = (modelo) => ev(`(async () => { const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  JUG.pos.set(0, 1.5, 0); JUG.yaw = 0; JUG.pitch = 0; await espera(300);
  const P = npcCrear(${JSON.stringify(modelo)}, v3(0, 0, 4), Math.PI, { modo: 'quieto' }); await espera(1500);
  // (la Physics Gun en la mano, apuntando al pecho del NPC)
  const iPG = ARM.lista.indexOf('PhysicsGun'); if (iPG >= 0) elegirArma(iPG); await espera(500);
  JUG.pitch = Math.atan2((P.pos.y + 0.3) - (CAM.pos.y), 4) * -1; await espera(200);
  const sones = []; const s0 = sonar; window.sonar = sonar = function (n, ...a) { sones.push(n); return s0.call(this, n, ...a); };
  // (como el jugador: el gatillo apretado mientras lo lleva)
  const p0 = P.pos.clone(); ENT.disparo = true; await espera(250); const agarrado = !!ARM.agarre;
  const rag = !!P.rag, sueloAgarrado = P.suelo, tieneDelRag = !!(ARM.agarre && P.rag && [...P.rag.cuerpos.values()].some((e) => e.b === ARM.agarre.b));
  // lo levanta y lo mueve 1,5 s
  JUG.pitch = -0.5; for (let i = 0; i < 15; i++) { JUG.yaw += 0.04; await espera(100); }
  const alto = P.pos.distTo(p0), mientras = sones.slice();
  const sigue = !!ARM.agarre && !!P.rag && [...P.rag.cuerpos.values()].some((e) => e.b === ARM.agarre.b);
  ENT.disparo = false; await espera(400); const cayendo = !!P.rag;
  // espera a que se levante (hasta 8 s)
  const t0 = performance.now(); while (P.rag && performance.now() - t0 < 8000) await espera(100);
  window.sonar = sonar = s0;
  return { sigue, agarrado, rag, sueloAgarrado, tieneDelRag, alto: +alto.toFixed(2), cayendo, levantado: !P.rag, vivo: P.vivo !== false, segLevantar: +((performance.now() - t0) / 1000).toFixed(1), sonidos: mientras.length, cuales: [...new Set(mientras)].slice(0, 8) }; })()`);
const r = await prueba('Soldier');
ok('al agarrarlo vivo con la Physics Gun se hace muñeco de trapo (sin la animación de saltar) y se lo sigue llevando', r.agarrado && r.rag && r.tieneDelRag && r.sigue, r);
ok('se lo puede llevar (se mueve más de 1 m con la pistola)', r.alto > 1, { movido: r.alto });
ok('al soltarlo cae como muñeco y después se levanta solo, vivo', r.cayendo && r.levantado && r.vivo, { seg: r.segLevantar });
ok('mientras se lo tiene no suenan sonidos repetidos (≤ 3 en 1,5 s)', r.sonidos <= 3, { sonidos: r.sonidos, cuales: r.cuales });
if (process.argv[3]) {
  const ruta = await ev(`(async () => { const A = await gmInstalar('158326196', { nombre: 'Iron Man', sinDeps: true }, new Uint8Array(await (await fetch('${process.argv[3]}/158326196.gma')).arrayBuffer())); await A.listo; return [...A.G.archivos.keys()].find((k) => /mark7_player\.mdl$/.test(k)) || null; })()`);
  await ev(`for (const P of [...NPC.lista]) borrarPersona(P); NPC.lista.length = 0; 1`);
  const g = await prueba('gmpm:' + ruta);
  ok('un NPC con el modelo de un addon (Iron Man) también se hace muñeco al agarrarlo vivo y se levanta solo', !!ruta && g.agarrado && g.rag && g.tieneDelRag && g.sigue && g.cayendo && g.levantado && g.vivo, { ruta, ...g });
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
