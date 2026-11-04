// los props de addons reales no atraviesan el piso: por cada addon (los .gma de una carpeta servida por HTTP) se
// instala, se ponen hasta 4 props del menú (gmPropsMenu) adelante, se espera 3 s de juego y se mide el punto más bajo
// del cuerpo contra el piso (rayo hacia abajo). Atraviesa si quedó más de 15 cm por debajo o si se fue (NaN / lejos).
// También anota los que van al menú y los que se sacan (armas tiradas, manos, pedazos).
// uso: node gmod_props_piso.mjs URL_HTML URL_CARPETA_GMA ARCHIVO_IDS [SALIDA.json]   (MODO=sacados: los que el menú saca; MAPA=...)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, LISTA, SAL = 'gmod_props_piso.json'] = process.argv;
const ids = fs.readFileSync(LISTA, 'utf8').split(/\s+/).filter(Boolean);
const res = []; let s = null;
const nueva = async () => { if (s) await s.b.close().catch(() => {}); s = await abrir(HTML); await s.ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida(${JSON.stringify(process.env.MAPA || 'FlatGrass')}); 1`); await s.p.waitForTimeout(2500);
  await s.ev(`window.esperaJuego = (q) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + q || performance.now() - r0 > 20000 ? ok() : setTimeout(f, 30)); f(); }); 1`); };
await nueva();
for (let i = 0; i < ids.length; i++) {
  const id = ids[i]; let r;
  try {
    r = await s.ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b);
      gmMenu(); const L = gmPropsMenu(A), out = { id: '${id}', n: A.nombre, modelos: A.modelos.length, enMenu: L.length, sacados: A.props.length - L.length, props: [] };
      const usar = ${process.env.MODO === 'sacados' ? 'A.props.filter((r) => !L.includes(r))' : 'L'};
      for (const m of usar.slice(0, 4)) {
        JUG.yaw = 0; JUG.pitch = 0.35; const o = spawnDelante('gm:' + m, {}); if (!o) { out.props.push({ m, puesto: false }); continue; }
        await esperaJuego(3);
        const a = o.b.aabb, cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, h = mundoRayo(v3(cx, a.y1 + 2, cz), v3(0, -1, 0), 50), piso = h ? a.y1 + 2 - h.t : NaN;
        const fin = [a.y0, a.y1, o.b.pos.x, o.b.pos.y].every(Number.isFinite);
        out.props.push({ m: m.replace(/^.*\\//, ''), phy: !!gmArchivo(m.slice(0, -4) + '.phy'), alto: +(a.y1 - a.y0).toFixed(2), bajo: fin ? +(a.y0 - (Number.isFinite(piso) ? piso : 0)).toFixed(2) : null, fin });
        borrarObjeto(o);
      }
      gmQuitar('${id}'); return out; })()`);
  } catch (e) { r = { id, error: String(e.message || e).slice(0, 140) }; await nueva(); }
  r.atraviesan = (r.props || []).filter((p) => p.fin === false || (p.bajo !== null && p.bajo < -0.15)).length;
  res.push(r); console.log(`${r.atraviesan ? 'FALLA' : 'OK   '} ${id} ${r.n || ''} menú ${r.enMenu}/${r.modelos} props ${(r.props || []).length} atraviesan ${r.atraviesan}${r.error ? ' ' + r.error : ''}`);
  if ((i + 1) % 20 === 0) await nueva();
  fs.writeFileSync(SAL, JSON.stringify(res, null, 1));
}
const P = res.flatMap((x) => x.props || []), mal = P.filter((p) => p.fin === false || (p.bajo !== null && p.bajo < -0.15));
console.log(`RESUMEN props ${P.length - mal.length}/${P.length} no atraviesan; addons sin falla ${res.filter((x) => !x.atraviesan && !x.error).length}/${res.length}`);
await s.b.close(); process.exit(0);
