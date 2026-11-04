// un arma de un mod tirada en el piso (ents.Create("weapon_...") desde Lua, como hacen los addons) cae con su modelo y,
// pasando por encima, se agarra y queda en la mano, como en GMod; también las de HL2 (weapon_shotgun).
// uso: node gmod_arma_suelo.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const GMA = process.argv[3], D = (process.argv[4] || '.') + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(process.argv[2]);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500);
for (const [id, clase] of [['128089118', 'm9k_acr'], [null, 'weapon_shotgun']]) {
  const r = await ev(`(async () => {
    if (${JSON.stringify(id)}) { const b = new Uint8Array(await (await fetch(${JSON.stringify(GMA)} + '/${id}.gma')).arrayBuffer()); await gmInstalar('${id}', { nombre: 'x', sinDeps: true }, b); }
    const espera = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 20000 ? ok() : setTimeout(f, 30)); f(); });
    const antes = ARM.lista.includes('gm:${clase}') || ARM.lista.includes(HL2_ARMAS['${clase}']);
    const f = JUG.pos.clone ? JUG.pos.clone() : v3(JUG.pos.x, JUG.pos.y, JUG.pos.z);
    // (desde Lua, como un addon: adelante del jugador, en el aire)
    luaCompilar('local w = ents.Create("${clase}") w:SetPos(Entity(1):GetPos() + Entity(1):GetForward() * 160 + Vector(0, 0, 40)) w:Spawn()', 'prueba.lua', GMA.R)();
    await espera(1.5);
    const e = [...GMA.ents.values()].find((x) => x.armaSuelo === '${clase}'), conCuerpo = !!(e && e.o && e.o.b), pos = conCuerpo ? e.o.b.pos.clone() : null;
    const enPiso = conCuerpo ? +(e.o.b.aabb.y0).toFixed(2) : null, modelo = e && e.modelo;
    if (conCuerpo) { JUG.pos.x = pos.x; JUG.pos.z = pos.z; } await espera(0.6);
    const tiene = ARM.lista.includes('gm:${clase}') || ARM.lista.includes(HL2_ARMAS['${clase}']), sigue = !!(e && e.vivo);
    return { antes, conCuerpo, modelo, enPiso, tiene, sigue };
  })()`);
  ok(`${clase}: tirado desde Lua cae con su modelo de mundo`, r.conCuerpo && /w_/.test(r.modelo || '') && r.enPiso !== null && r.enPiso > -0.2, r);
  ok(`${clase}: pasando por encima se agarra (queda en la mano y desaparece del piso)`, !r.antes && r.tiene && !r.sigue, r);
}
await p.screenshot({ path: D + 'arma_suelo.png' });
const e2 = err.filter((x) => !/favicon|net::ERR|Failed to load resource|WebGL|GPU stall|swiftshader/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close(); process.exit(0);
