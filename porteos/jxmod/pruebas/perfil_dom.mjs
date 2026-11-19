// ¿Qué le cuesta al navegador la página en cada cuadro, fuera del JavaScript del juego? En un celu con procesador chico
// (Cortex-A53/A55) recalcular estilos, acomodar y pintar la interfaz HTML encima del juego compite con el cuadro.
// Entra a un mapa con los controles táctiles y cuenta, por cuadro: recálculos de estilo, acomodos (layout) y su tiempo
// (Performance.getMetrics de Chrome), y qué elementos de la página se tocan (MutationObserver: atributos, texto, hijos).
// uso: node perfil_dom.mjs URL_HTML [calidad=patata] [segundos=5]   (MAPA=Desert, FRENO=N: el procesador N veces más lento)
import { abrir } from './base.mjs';
const [, , HTML, CAL = 'patata', SEG = '5'] = process.argv;
const { b, p, ev } = await abrir(HTML, true);
const cdp = await p.context().newCDPSession(p); await cdp.send('Performance.enable');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.resDin = false; const p = PERFILES[PREFS.gfx]; PREFS.res = p.res; PREFS.lejos = p.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida(${JSON.stringify(process.env.MAPA || 'Desert')}); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
await ev(`(() => { cerrarPaneles(); JUG.yaw = 0; JUG.pitch = 0.1; DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
// (caminando y girando, como se juega: la HUD de verdad cambia con lo que pasa)
await ev(`(() => { window.__domT = setInterval(() => { JUG.yaw += 0.02; }, 16); if (typeof ENT !== 'undefined' && ENT.mov) { ENT.mov.y = 1; } return 1; })()`);
await p.waitForTimeout(1500);
const FRENO = +(process.env.FRENO || 1); if (FRENO > 1) { await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO }); await p.waitForTimeout(1500); }
await ev(`(() => { const M = window.__mut = new Map(); window.__cuadros = 0; const q = (n) => { if (!n || n.nodeType !== 1) n = n && n.parentElement; if (!n) return '?'; let s = n.id ? '#' + n.id : n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\s+/)[0] : ''); const pa = n.parentElement; if (!n.id && pa) s = (pa.id ? '#' + pa.id : pa.tagName.toLowerCase() + (typeof pa.className === 'string' && pa.className ? '.' + pa.className.trim().split(/\\s+/)[0] : '')) + ' > ' + s; return s; };
  window.__mo = new MutationObserver((L) => { for (const m of L) { const k = m.type + ' ' + q(m.target) + (m.attributeName ? ' [' + m.attributeName + ']' : ''); M.set(k, (M.get(k) || 0) + 1); } });
  window.__mo.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
  const f = () => { window.__cuadros++; window.__rafD = requestAnimationFrame(f); }; window.__rafD = requestAnimationFrame(f); return 1; })()`);
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const a = await met(); await p.waitForTimeout(+SEG * 1000); const z = await met();
const r = await ev(`(() => { window.__mo.disconnect(); cancelAnimationFrame(window.__rafD); clearInterval(window.__domT); return { cuadros: window.__cuadros, mut: [...window.__mut].sort((a, b) => b[1] - a[1]).slice(0, 25), nodos: document.getElementsByTagName('*').length, fps: Math.round(TIEMPO.fps), lienzo: R.cv.width + 'x' + R.cv.height }; })()`);
const n = Math.max(1, r.cuadros), d = (k) => z[k] - a[k];
console.log(JSON.stringify({ calidad: CAL, mapa: process.env.MAPA || 'Desert', freno: FRENO, cuadros: r.cuadros, fps: r.fps, lienzo: r.lienzo, nodos: r.nodos,
  porCuadro: { estilos: +(d('RecalcStyleCount') / n).toFixed(2), msEstilos: +(d('RecalcStyleDuration') * 1000 / n).toFixed(3), acomodos: +(d('LayoutCount') / n).toFixed(2), msAcomodos: +(d('LayoutDuration') * 1000 / n).toFixed(3),
    msScript: +(d('ScriptDuration') * 1000 / n).toFixed(2), msTareas: +(d('TaskDuration') * 1000 / n).toFixed(2), cambiosPagina: +(r.mut.reduce((s, x) => s + x[1], 0) / n).toFixed(1) },
  queSeToca: r.mut.map(([k, v]) => k + ' ×' + +(v / n).toFixed(2)) }, null, 1));
await b.close();
