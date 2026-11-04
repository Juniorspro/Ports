// ¿qué arma de addon frena el cuadro? Para cada addon con armas (de a uno, sacando el anterior): la pone en la mano y
// mide lo que cuesta por cuadro su Lua: el paso del Lua (Think del arma, hooks, timers), dibujar el arma en primera
// persona (PreDrawViewModel/ViewModelDrawn/PostDrawViewModel), su HUD (HUDPaint, DrawHUD) y la cámara (CalcView). Dos
// números: en frío (las primeras 20 veces, recién sacada) y estable (después de 60 vueltas, como queda jugando: el
// navegador ya compiló el código). A 60 cuadros hay 16,7 ms por cuadro y en un celular de gama baja el procesador es
// 3-4 veces más lento que esta máquina: cada arma debería costar ≤ 0,5 ms acá.
// uso: node opt_armas.mjs URL_HTML URL_CARPETA_GMA ID1,ID2,...
import { abrir } from './base.mjs';
const [, , HTML, CARP, IDS] = process.argv;
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const filas = [];
for (const id of IDS.split(',')) {
  const r = await ev(`(async () => {
    const res = await fetch(${JSON.stringify(CARP)} + '/${id}.gma'); if (!res.ok) return { id: '${id}', error: 'sin gma' };
    let A; try { A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, new Uint8Array(await res.arrayBuffer())); await A.listo; } catch (e) { return { id: '${id}', error: String(e).slice(0, 80) }; }
    const armas = (A.sweps || []).filter((w) => !/base|gmod_tool|blacklist/i.test(w)).slice(0, 3), out = [];
    for (const w of armas) {
      try { gmaDarArma(w); elegirArma(ARM.lista.indexOf('gm:' + w)); } catch (e) { out.push({ w, error: String(e).slice(0, 60) }); continue; }
      await new Promise((ok) => setTimeout(ok, 1200));
      const e0 = GMA.errores.length, T = {}, F = {};
      const vueltas = (f, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) { try { f(); } catch (e) {} } return (performance.now() - t0) / n; };
      const med = (k, f) => { F[k] = vueltas(f, 20); vueltas(f, 60); T[k] = +vueltas(f, 200).toFixed(3); };
      med('lua', () => gmLuaPaso(1 / 60));
      med('vista', () => gmrVistaArma());
      med('hud', () => gmaHUDPaso());
      med('calcView', () => gmaVistaLua(CAM));
      const tot = +(T.lua + T.vista + T.hud + T.calcView).toFixed(3), frio = +(F.lua + F.vista + F.hud + F.calcView).toFixed(3);
      out.push({ w, ...T, tot, frio, errs: GMA.errores.slice(e0, e0 + 2) });
    }
    try { gmQuitar('${id}'); } catch (e) {}
    return { id: '${id}', nombre: A.nombre, armas: out };
  })()`);
  console.log(JSON.stringify(r));
  for (const a of r.armas || []) filas.push([id, a.w, a.tot, a.frio]);
  await p.waitForTimeout(500);
}
filas.sort((a, b) => b[2] - a[2]);
console.log('PEORES ' + JSON.stringify(filas.slice(0, 10)));
console.log(`RESUMEN ${filas.filter((f) => f[2] <= 0.5).length}/${filas.length} armas ≤ 0,5 ms por cuadro (estable) · en frío ${filas.filter((f) => f[3] <= 0.5).length}/${filas.length}`);
await b.close(); process.exit(0);
