// Panel q55n3p6u: «que al morir la cámara siga al ragdoll». El jugador muere corriendo a 12 m/s (el muñeco sale despedido):
//  1. la cámara queda a menos de 4,5 m del muñeco todo el tiempo;
//  2. y se aleja del lugar donde murió junto con él (antes quedaba ahí).
// uso: node camara_muneco.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev } = await abrir(HTML + '?test');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo && !!JUG.cuerpo`), null, { timeout: 90000 });
await p.waitForTimeout(800);
const r = await ev(`(() => { JUG.yaw = 0; JUG.pitch = 0.2; JUG.vel.set(0, 3, 12); const muerte = JUG.pos.clone(); morirJugador(); const P = JUG.cuerpo; let peor = 0, lejosMuerte = 0, lejosMuneco = 0;
  for (let i = 0; i < 150; i++) { physStep(1 / 60); ragdollPaso(P); TIEMPO.dt = 1 / 60; camaraActualizar(1 / 60); const dm = CAM.pos.distTo(P.pos); peor = Math.max(peor, dm); lejosMuerte = CAM.pos.distTo(muerte); lejosMuneco = P.pos.distTo(muerte); }
  return { rag: !!P.rag, peor: +peor.toFixed(2), camLejosMuerte: +lejosMuerte.toFixed(2), munecoLejosMuerte: +lejosMuneco.toFixed(2) }; })()`);
ok('1. la cámara sigue cerca del muñeco (< 4,5 m)', r.rag && r.peor < 4.5, r);
ok('2. se aleja del lugar donde moriste junto con el muñeco', r.munecoLejosMuerte > 2 && r.camLejosMuerte > r.munecoLejosMuerte - 3.5, r);
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
