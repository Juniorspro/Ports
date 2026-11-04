// tanda de instalación: cada addon se baja por la tienda publicada (directo o SteamPipe), se instala y se monta en una
// partida; se anota si falló y por qué (y cuánto tardó). No prueba si anda: eso es gmod_tanda.mjs.
// uso: node gmod_instalar_tanda.mjs URL_HTML ARCHIVO_IDS [SALIDA.json]
import { abrir } from './base.mjs';
import fs from 'fs';
const ids = fs.readFileSync(process.argv[3], 'utf8').split(/\s+/).filter(Boolean), SAL = process.argv[4] || 'gmod_instalar_tanda.json';
const res = []; let s = null;
const nueva = async () => { if (s) await s.b.close().catch(() => {}); s = await abrir(process.argv[2]); await s.ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await s.p.waitForTimeout(2500); };
await nueva();
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  let r;
  try {
    r = await Promise.race([s.ev(`(async () => { const t0 = performance.now(), e0 = GMOD.errores.length, l0 = GMA.errores.length; try { const A = await gmInstalar('${id}');
        const o = { id: '${id}', ok: true, n: A.nombre, seg: +((performance.now() - t0) / 1000).toFixed(1), props: A.props.length, sweps: (A.sweps || []).length, sents: (A.sents || []).length, luaErr: (A.luaErr || []).length, gmErr: GMOD.errores.slice(e0, e0 + 3).map(String), faltan: (A.faltanModelos || []).length };
        gmQuitar('${id}'); return o; } catch (e) { return { id: '${id}', ok: false, e: String(e && e.message || e).slice(0, 160), seg: +((performance.now() - t0) / 1000).toFixed(1) }; } })()`),
      new Promise((ok) => setTimeout(() => ok({ id, ok: false, e: 'tardó más de 240 s' }), 240000))]);
  } catch (e) { r = { id, ok: false, e: 'la página se cayó: ' + String(e.message || e).slice(0, 120) }; await nueva(); }
  res.push(r); console.log((r.ok ? 'OK   ' : 'FALLA') + ' ' + id + ' ' + (r.n || '') + ' ' + (r.ok ? r.seg + ' s' : r.e));
  if (!r.ok && /tardó|cayó/.test(r.e)) await nueva();
  if ((i + 1) % 15 === 0) await nueva();   // (navegador nuevo cada 15: no acumular memoria)
  fs.writeFileSync(SAL, JSON.stringify(res, null, 1));
}
const malos = res.filter((x) => !x.ok);
console.log(`RESUMEN instalados ${res.length - malos.length}/${res.length}`);
await s.b.close(); process.exit(0);
