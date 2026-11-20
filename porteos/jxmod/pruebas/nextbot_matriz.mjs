// Nextbots que se agrandan con EnableMatrix("RenderMultiply") (panel, bug «Pumkin rabbit nextbot — se hizo enano»): el
// Pumpkin Rabbit de The Mysterious House (DrGBase, 3537414574; su modelo viene en el pill pack 3532749231) mide 13
// unidades en su .mdl y en su CustomInitialize se escala ×10 con esa matriz (sólo del lado del cliente). Antes el juego
// la guardaba y no la usaba en los modelos animados: salía de 33 cm.
//  1. el conejo y el sin máscara (su «evolución») se dibujan 10 veces más altos que sin la matriz (±1 %), con los pies en
//     el piso (el hueso más bajo a menos de 15 cm del origen);
//  2. los huesos que lee el Lua (GetBonePosition de la cabeza) no cambian con la matriz, como en GMod (±1 %);
//  3. sin errores de JS. Foto de costado en CARPETA.
// Baja los addons del Workshop como un jugador (~1 GB la primera vez; quedan en el perfil).
// uso: node nextbot_matriz.mjs URL_HTML [CARPETA=/tmp/claude-0/nextbot_matriz] [PERFIL=/tmp/claude-0/perfil_nb]
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, D = '/tmp/claude-0/nextbot_matriz', PERFIL = '/tmp/claude-0/perfil_nb'] = process.argv; fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const ctx = await chromium.launchPersistentContext(PERFIL, { executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'], viewport: { width: 960, height: 540 } });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = ctx.pages()[0] || (await ctx.newPage()); const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const inst = await ev(`(async () => { try { for (const id of ['3532749231', '3537414574']) { const A = await gmInstalar(id, { nombre: id }); if (A && A.listo) await A.listo; } return [...GMOD.addons.keys()]; } catch (e) { return 'ERR ' + e; } })()`);
if (!Array.isArray(inst) || !inst.includes('3537414574')) { console.log('no se pudo instalar', inst); process.exit(1); }
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(1500);
const lua = (src) => ev(`(() => { const R = GMA.R; try { const f = luaCompilar(${JSON.stringify(src)}, 'prueba.lua', R); return gmaEnLado('S', () => R.c(f, 'prueba'))[0]; } catch (x) { return 'ERR ' + x.message; } })()`);
await lua(`RunConsoleCommand('ai_ignoreplayers', '1')`);
await ev(`(() => { JUG.pos.set(0, JUG.pos.y, 0); JUG.yaw = 0; JUG.pitch = 0; return 1; })()`);
// alto dibujado: los huesos que dibuja el juego (sin el de la cámara ni los nodos de las mallas, que van después de los
// huesos), con y sin la matriz, en el mismo cuadro de la animación; y dónde quedan los pies
const medir = (cls) => ev(`(async () => {
  const e = [...GMA.ents.values()].find((x) => (x.clase || '').toLowerCase() === ${JSON.stringify(cls)} && x.vivo !== false && x.nbW); if (!e) return null;
  const def = gmnbDef(e), M = def.M, alto = () => { let y0 = 1e9, y1 = -1e9; for (let i = 1; i <= def.nb; i++) { if (/camera/i.test((M.huesos[i - 1] || {}).n || '')) continue; const y = e.nbW[i][13]; if (y < y0) y0 = y; if (y > y1) y1 = y; } return y1 - y0; };
  const cab = () => { const r = gmaEnLado('S', () => GMA.R.c(luaCompilar("local e = ents.FindByClass('${cls}')[1] local i = e:LookupBone('Head') local p = i and e:GetBonePosition(i) return p and (p.z - e:GetPos().z) or -1", 'c.lua', GMA.R), 'c'))[0]; return +r; };
  const m0 = e.matriz, sec0 = e.nbSec && { ...e.nbSec };
  const cuadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  await cuadro(); const con = alto(), cabCon = cab();
  e.matriz = null; if (sec0) Object.assign(e.nbSec, sec0); await cuadro(); const sin = alto(), cabSin = cab(); e.matriz = m0;
  let pie = 1e9; for (let i = 1; i <= def.nb; i++) pie = Math.min(pie, e.nbW[i][13]); pie -= gmaOrigen(e.o).y;
  return { matriz: !!(m0 && m0.m), pie: +pie.toFixed(3), con: +con.toFixed(3), sin: +sin.toFixed(3), razon: +(con / sin).toFixed(3), cabCon: +cabCon.toFixed(2), cabSin: +cabSin.toFixed(2) };
})()`);
for (const cls of ['npc_drg_pumpkinrabbit', 'npc_drg_pumpkinrabbitmaskless']) {
  await ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); gmnpcCrear(${JSON.stringify(cls)}); return 1; })()`);
  await p.waitForFunction((c) => window.__ev(`[...GMA.ents.values()].some((x) => (x.clase || '').toLowerCase() === ${JSON.stringify(c)} && x.nbW)`), cls, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const m = await medir(cls);
  chk(m && m.matriz && Math.abs(m.razon - 10) <= 0.1 && Math.abs(m.pie) < 0.15, `1. ${cls}: se dibuja 10 veces más alto con su matriz, con los pies en el piso`, m);
  chk(m && m.cabSin > 0 && Math.abs(m.cabCon - m.cabSin) <= Math.max(0.01 * m.cabSin, 0.05), `2. ${cls}: los huesos que lee el Lua no cambian`, m && { cabCon: m.cabCon, cabSin: m.cabSin });
  // (de costado, a la altura del jugador)
  await ev(`(() => { const e = [...GMA.ents.values()].find((x) => (x.clase || '').toLowerCase() === ${JSON.stringify(cls)}); const q = gmaEntPos(e); JUG.pos.set(q.x - 7, JUG.pos.y, q.z); JUG.yaw = Math.PI / 2; JUG.pitch = 0.12; return 1; })()`);
  await p.waitForTimeout(800); await p.screenshot({ path: `${D}/${cls}.jpg`, quality: 80, type: 'jpeg' });
}
chk(!err.length, '3. sin errores de JS', err.slice(0, 4));
console.log(`\n${ok}/${ok + mal}`);
await ctx.close(); process.exit(mal ? 1 : 0);
