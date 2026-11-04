// Shaders nuevos en la partida (KHR_parallel_shader_compile, progDe): ya andando, aparecen cosas que necesitan programas que
// no estaban (personas con piel, barriles, lo que sea nuevo). Si el navegador no tiene la extensión (SwiftShader no la
// tiene), se la imita: cada programa «termina» 400 ms después de enlazarse. Se mira que mientras tanto queden pendientes,
// que después se dibujen, que no haya errores de WebGL (un programa equivocado con uniformes de otro da INVALID_OPERATION)
// y que al final se vea lo mismo que sin paralelo (?kpar=0); con la extensión de verdad, también el cuadro más largo.
// uso: node shaders_paralelo.mjs URL_HTML [CARPETA=/tmp/claude-0/shaders]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/shaders'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const IMITAR = () => {
  const P = WebGL2RenderingContext.prototype, ge = P.getExtension, gp = P.getProgramParameter, lk = P.linkProgram;
  P.getExtension = function (n) { const x = ge.call(this, n); if (x || n !== 'KHR_parallel_shader_compile') return x; window.__imitada = true; return { COMPLETION_STATUS_KHR: 0x91B1, maxShaderCompilerThreadsKHR() { } }; };
  P.linkProgram = function (p) { if (p) p.__t0 = performance.now(); return lk.call(this, p); };
  P.getProgramParameter = function (p, n) { if (n === 0x91B1) return performance.now() - (p.__t0 || 0) > 400; return gp.call(this, p, n); };
};
const medir = async (extra) => {
  const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'gl=2' + extra, true, null, extra ? undefined : async (pg) => { await pg.addInitScript(IMITAR); });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; const q = PERFILES.alto; PREFS.res = q.res; PREFS.lejos = q.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
  await ev(`(() => { cerrarPaneles(); DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); JUG.yaw = 0; JUG.pitch = 0.15; return 1; })()`);
  await p.waitForTimeout(8000);   // (pasan los 6 s después de entrar: desde acá lo nuevo va en paralelo)
  const r = await ev(`(async () => {
    const kpar = !!R.kpar, imitada = !!window.__imitada, antes = R.progs.size, T = []; let on = true, ult = performance.now(), pendMax = 0;
    const paso = () => { const t = performance.now(); T.push(t - ult); ult = t; pendMax = Math.max(pendMax, R.progsPend.size); if (on) requestAnimationFrame(paso); }; requestAnimationFrame(paso);
    R.gl.getError();
    await new Promise((ok) => setTimeout(ok, 600));
    const f = CAM.fwd, n0 = T.length;
    for (const [k, m] of ['Soldier', 'Hero', 'Freddy', 'Goku'].entries()) try { npcCrear(m, v3(JUG.pos.x + f.x * (4 + k), JUG.pos.y - 0.9, JUG.pos.z + f.z * (4 + k) + k - 1.5), 0, { modo: 'quieto', vida: 100 }); } catch (e) { }
    for (const x of ['Barrel', 'Crate', 'Sofa', 'Melon', 'Bucket', 'Radio']) try { spawnDelante(x, {}); } catch (e) { }
    await new Promise((ok) => setTimeout(ok, 3000));
    on = false; const D = T.slice(n0), max = Math.max(...D), pend = R.progsPend.size;
    const glErr = R.gl.getError();
    return { kpar, imitada, pendMax, glErr, programasNuevos: R.progs.size - antes, pendientes: pend, cuadros: D.length, maxMs: Math.round(max), sobre100: D.filter((x) => x > 100).length, total: Math.round(D.reduce((a, b) => a + b, 0)) };
  })()`);
  await p.waitForTimeout(1500);
  const foto = `${D}/fin${extra.replace(/\W/g, '') || '_kpar'}.png`; await p.locator('#cv').screenshot({ path: foto });
  r.dibujadas = await ev('R.dibujadas'); r.foto = foto; r.err = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x)).slice(0, 3);
  await b.close(); return r;
};
const a = await medir(''), s = await medir('&kpar=0');
console.log(JSON.stringify({ paralelo: a, sinParalelo: s }));
ok('con la extensión (de verdad o imitada) lo nuevo se compila en paralelo: queda pendiente un rato', a.kpar && a.pendMax > 0, { kpar: a.kpar, imitada: a.imitada, pendientesMax: a.pendMax });
ok('lo nuevo termina de compilar y se dibuja (sin programas pendientes al final)', a.pendientes === 0 && a.programasNuevos > 0, { nuevos: a.programasNuevos, pendientes: a.pendientes });
ok('sin errores de WebGL (ningún dibujo con el programa equivocado)', a.glErr === 0 && s.glErr === 0, { con: a.glErr, sin: s.glErr });
ok('al final se dibuja lo mismo con y sin paralelo', Math.abs(a.dibujadas - s.dibujadas) <= 3, { con: a.dibujadas, sin: s.dibujadas });
if (!a.imitada) ok('el cuadro más largo al aparecer lo nuevo es más corto con la compilación en paralelo', a.maxMs < s.maxMs, { con: a.maxMs, sin: s.maxMs });
ok('sin errores de JS', !a.err.length && !s.err.length, [...a.err, ...s.err]);
console.log(R0.every(Boolean) ? 'TODO BIEN ' + R0.length + '/' + R0.length : 'FALLAS ' + R0.filter((x) => !x).length);
