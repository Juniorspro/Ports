// Nextbots de DrGBase a la velocidad de GMod y Cartman/Kenny de South Park sin romperse (Discord, noviembre de 2026: «los de
// DrGBase caminan MUUUUY despacio»; «No deja instalar varios nextbots, la mayoría 3D: o están rotos o sus modelos están
// rotos», con una foto de Cartman y Kenny). Con DrGBase (1560118657) y el contenido base que usan sus NPC de ejemplo —la
// hormiga león, el G-Man y m_anm.mdl, tal como el juego los baja de Steam— guardado en /tmp/claude-0/srv/gma/base_ev6:
//  A1. la hormiga león de DrGBase (UseWalkframes: camina a lo que avanza su animación) persigue al jugador a la velocidad
//      de suelo de su animación de correr, la de GMod (a_RunN: 106,5 pulgadas en 0,3 s = 355 pulgadas/s ≈ 9 m/s), ±20 %;
//      antes iba a 100 (2,5 m/s);
//  A2. el «Test Nextbot» (modelo de jugador, RunSpeed 300 en su Lua) persigue a 300 ±20 %, corre con la celda de correr
//      para adelante de la mezcla (move_x ≈ 1, move_y ≈ 0) y el paso de la animación es su velocidad sobre la velocidad
//      de suelo de esa celda (±20 %); antes, sin move_x/move_y, la celda del medio —a_WalkC, caminar en el lugar— con
//      el paso en 1: se deslizaba «caminando muy despacio»;
//  A3. Doro (3505279804, RunSpeed 600, animaciones sin walkframes) persigue a 600 ±20 % con el paso de la animación en 1;
//  B1. los tres nextbots de Cartman (2844252208, 2831164661, 2806631674: la clase con mayúsculas, «npc_EricCartman») y el
//      de Kenny (2850514167) salen como su nextbot —antes los de Cartman salían como un NPC cualquiera del juego— con su
//      sprite real, cuadrado (alto/ancho = 1 ±5 %), parado (de abajo hacia arriba a ≤ 15° de la vertical) y en el piso;
//  B2. Cartman y Kenny 3D (los modelos de South Park 3832733494, 3832670573, 1878108687 y 370144942) como nextbots de
//      DrGBase y como NPC: la malla dibujada —cada vértice con su piel— tiene el alto y el ancho del cuerpo de su pose de
//      enlace (±15 %), está parada (de la cadera a la cabeza a ≤ 15° de la vertical) y pisa el piso (±6 cm, o el 3 % del
//      alto en uno grande); antes los chicos como NPC tenían los pies 10 a 15 cm bajo tierra;
//  B3. los mismos como muñeco de trapo (Props → Mods): la malla queda sobre el piso (lo más bajo, entre −3 y +15 cm del
//      piso); antes quedaban de medio metro a más de un metro bajo tierra y no se veían;
//  C. sin errores de Lua ni de JS.
// Fotos para mirar en /tmp/claude-0/ev6/.
// uso: node ev6_nextbots.mjs URL_HTML [URL_CARPETA_GMA] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G = new URL('/gma', HTML).href, D = '/tmp/claude-0/ev6'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1500) : '')); };
const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'test', false);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); try { cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); } catch (e) {} 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await p.waitForTimeout(1500);
const INST = (id) => ev(`(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, u); await A.listo; return { npcs: [...((A.listas && A.listas.NPC) || new Map()).keys()], err: (A.luaErr || []).slice(0, 3) }; })()`);
const lua = (src) => ev(`(() => { const R = GMA.R; try { const f = luaCompilar(${JSON.stringify(src)}, 'prueba.lua', R); return JSON.stringify(gmaEnLado('S', () => R.c(f, 'prueba'))[0]); } catch (x) { return JSON.stringify('ERR ' + x.message); } })()`).then((r) => JSON.parse(r));
const lua0 = (await ev(`GMA.errores.length`)) | 0;
// el contenido base: los archivos como llegan de Steam, puestos en la biblioteca del juego (GML) antes de usarlos
const BASE = ['models/antlion.mdl', 'models/antlion.ani', 'models/antlion.vvd', 'models/antlion.dx90.vtx', 'models/player/gman_high.mdl', 'models/player/gman_high.vvd', 'models/player/gman_high.dx90.vtx', 'models/m_anm.mdl', 'models/m_anm.ani'];
const base = await ev(`(async () => { const L = ${JSON.stringify(BASE)}; let n = 0; for (const r of L) { const x = await fetch(${JSON.stringify(G)} + '/base_ev6/' + r); if (!x.ok) continue; GML.datos.set(r, new Uint8Array(await x.arrayBuffer())); n++; } try { gmlLlegaron(L); } catch (e) {} return n; })()`);
const inst = {}; for (const id of ['1560118657', '3505279804']) inst[id] = await INST(id);
// (el jugador no recibe daño: los que persiguen lo alcanzan)
await ev(`(() => { window.__dan0 = danarJugador; danarJugador = () => {}; return 1; })()`);
const limpiar = `(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); npcTodos(); JUG.pos.set(0, JUG.pos.y, 0); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.08; JUG.vida = 100; JUG.vivo = true; return 1; })()`;
const PISO = await ev(`(() => { const h = mundoRayo(v3(0, 6, 8), v3(0, -1, 0), 30); return h ? 6 - h.t : null; })()`);
// un nextbot de una clase, 8 m adelante, mirando al jugador
const poner = (cls, z = 8) => ev(`(() => { const e = gmLlamar(GMA.R.G.get('__gmCrearNPC'), 'S', '${cls}', GMA.V(v3(0, ${PISO}, ${z})))[0]; if (!(e instanceof LEnt)) return null; e.creador = GMA.jug; return e.clase; })()`);
const ent = (cls) => `[...GMA.ents.values()].find((x) => x.clase === '${cls}' && x.vivo !== false)`;
const esperarModelo = async (cls, ms = 8000) => { for (let t = 0; t < ms; t += 250) { if (await ev(`(() => { const e = ${ent(cls)}; return !!(e && gmnbDef(e) && e.nbSec); })()`)) return true; await p.waitForTimeout(250); } return false; };

// ---------- A: la velocidad persiguiendo ----------
// (el jugador a 45 m, a la vista; muestras cada 200 ms durante 3 s mientras está a más de 4 m: la mediana)
async function persecucion(cls, nombre) {
  await ev(limpiar); await p.waitForTimeout(300);
  await poner(cls); const cargo = await esperarModelo(cls, 15000);
  await ev(`(() => { JUG.pos.z -= 45; return 1; })()`);
  await lua(`local e = ents.FindByClass('${cls}')[1]; if IsValid(e) and e.SpotEntity then e:SpotEntity(player.GetAll()[1]) end return 1`);
  await p.waitForTimeout(1300);
  const S = [];
  for (let k = 0; k < 16; k++) {
    S.push(await ev(`(() => { const e = ${ent(cls)}; if (!e) return null; const q = gmaEntPos(e), d = gmnbDef(e), s = e.nbSec, sq = d && s ? d.M.secuencias[s.i] : null, ia = sq && sq.grid ? GMF.animDe(d.M, s.i, e.poseVals) : s ? s.anim : -1;
      return { t: TIEMPO.t, x: q.x, z: q.z, d: Math.hypot(q.x - JUG.pos.x, q.z - JUG.pos.z), sec: sq ? sq.n : null, anim: d && ia >= 0 ? d.M.anims[ia].n : null, rate: e.nbRate ?? 1, vs: d && s && typeof GMF.secVelSuelo === 'function' ? GMF.secVelSuelo(d.M, s.i, e.poseVals) : null, mx: e.poseVals && e.poseVals.move_x, my: e.poseVals && e.poseVals.move_y }; })()`));
    if (k === 15) await p.screenshot({ path: `${D}/ev6_A_${nombre}.png` });   // (al final, ya más cerca)
    await p.waitForTimeout(200);
  }
  const L = S.filter(Boolean), v = [];
  for (let i = 1; i < L.length; i++) { const a = L[i - 1], z = L[i]; if (a.d > 4 && z.d > 4 && z.t > a.t) v.push({ v: Math.hypot(z.x - a.x, z.z - a.z) / (z.t - a.t) / 0.0254, s: z }); }
  v.sort((x, y) => x.v - y.v); const m = v.length ? v[Math.floor(v.length / 2)] : null;
  const lu = await lua(`local e = ents.FindByClass('${cls}')[1]; if not IsValid(e) then return {} end return { e.WalkSpeed, e.RunSpeed, e.UseWalkframes, e:IsRunning() }`);
  return { cargo, vel: m ? Math.round(m.v) : null, ms: m ? +(m.v * 0.0254).toFixed(2) : null, n: v.length, sec: m && m.s.sec, anim: m && m.s.anim, rate: m ? +m.s.rate.toFixed(3) : null, vs: m ? Math.round(m.s.vs) : null, mx: m && m.s.mx != null ? +(+m.s.mx).toFixed(2) : null, my: m && m.s.my != null ? +(+m.s.my).toFixed(2) : null, lua: lu && lu.a };
}
const cerca = (x, y, tol) => x != null && y > 0 && Math.abs(x / y - 1) <= tol;
const A1 = await persecucion('npc_drg_antlion', 'hormiga');
ok('A1. la hormiga león de DrGBase (UseWalkframes) persigue a la velocidad de su animación de correr, la de GMod (355 pulgadas/s ±20 %)', base === BASE.length && A1.cargo && cerca(A1.vel, 355, 0.2), A1);
const A2 = await persecucion('npc_drg_testnextbot', 'gman');
ok('A2. el Test Nextbot (RunSpeed 300) persigue a 300 ±20 %, con la celda de correr para adelante (move_x ≈ 1) y el paso = velocidad / velocidad de suelo (±20 %)', A2.cargo && cerca(A2.vel, 300, 0.2) && A2.mx > 0.9 && Math.abs(A2.my) < 0.3 && A2.vs > 0 && cerca(A2.rate, A2.vel / A2.vs, 0.2), A2);
const A3 = await persecucion('doroxd', 'doro');
ok('A3. Doro (RunSpeed 600, animaciones sin walkframes) persigue a 600 ±20 % con el paso en 1', !!A3.sec && cerca(A3.vel, 600, 0.2) && Math.abs(A3.rate - 1) < 0.02, A3);
await ev(limpiar);

// ---------- B1: los de sprite (Cartman con la clase en mayúsculas, Kenny) ----------
// (el cuadro que dibuja su Lua —render.DrawQuadEasy de 128×128—: sus cuatro esquinas en la lista de lo dibujado, y si la
// textura es la del addon o una de reemplazo)
const SPR = [['2844252208', 'cartman_ericcartman'], ['2831164661', 'cartman_cartman'], ['2806631674', 'cartman_eric'], ['2850514167', 'kenny_mccormick']];
const B1 = [];
for (const [id, nom] of SPR) {
  const r = await INST(id), c = r.npcs[0];
  await ev(limpiar); await p.waitForTimeout(300);
  // (quieto a 10 m, mirado desde la altura de los ojos: que no llegue al jugador mientras se mide)
  await ev(`(() => { const x = gmnpcCrear(${JSON.stringify(c)}); window.__e = x; return 1; })()`);
  const quieto = `(() => { const x = window.__e; if (!(x instanceof LEnt) || !x.loco) return 0; const L = x.loco.st; L.v.set(0, 0, 0); L.vel0 = 0; L.acel = 0; GMA.metas.Entity.get('SetPos')(x, GMA.V(v3(0, ${PISO}, 10))); return 1; })()`;
  await ev(quieto); await p.waitForTimeout(250); await ev(quieto); await p.waitForTimeout(250);
  const e = await ev(`(() => { const x = window.__e; if (!(x instanceof LEnt)) return { tipo: x ? 'npc del juego (' + (x.skin || '?') + ')' : null }; const q = gmaEntPos(x); return { tipo: 'nextbot', clase: x.clase, getClass: x.claseNom || x.clase, nb: !!x.nb, y: +q.y.toFixed(3), z: +q.z.toFixed(2) }; })()`);
  const q = await ev(`(() => { const x = window.__e; if (!(x instanceof LEnt)) return null; const P = gmaEntPos(x), out = [];
    for (const t of GR.L.mundo) { if (!t.n || t.n !== 6) continue; const V = []; for (const k of [0, 1, 2, 5]) { const o = (t.o + k) * 9; V.push([GR.vb[o], GR.vb[o + 1], GR.vb[o + 2], GR.vb[o + 7], GR.vb[o + 8]]); }   // (las cuatro esquinas: son dos triángulos, 0 1 2 y 0 2 3)
      const cx = V.reduce((s, v) => s + v[0], 0) / 4, cz = V.reduce((s, v) => s + v[2], 0) / 4; if (Math.hypot(cx - P.x, cz - P.z) > 2) continue;
      const m = t.m; let tx = 'sin'; try { const T = m && m.tex && m.tex(); tx = !T ? 'sin' : 'real'; for (const k in GR.tex) if (GR.tex[k] === T) tx = 'reemplazo:' + k; } catch (e) { tx = 'err'; }
      const prom = (f) => { const L = V.filter(f); return [0, 1, 2].map((c) => L.reduce((s, v) => s + v[c], 0) / Math.max(1, L.length)); };
      const arr = prom((v) => v[4] > 0.5), aba = prom((v) => v[4] < 0.5), izq = prom((v) => v[3] < 0.5), der = prom((v) => v[3] > 0.5);
      const up = [arr[0] - aba[0], arr[1] - aba[1], arr[2] - aba[2]], alto = Math.hypot(...up), ancho = Math.hypot(der[0] - izq[0], der[1] - izq[1], der[2] - izq[2]);
      const bajo = Math.min(...V.map((v) => v[1]));
      out.push({ tx, alto: +alto.toFixed(3), ancho: +ancho.toFixed(3), ang: +(Math.acos(Math.max(-1, Math.min(1, up[1] / Math.max(1e-6, alto)))) * 180 / Math.PI).toFixed(1), pie: +(bajo - P.y).toFixed(3) }); }
    return out; })()`);
  await p.screenshot({ path: `${D}/ev6_B1_sprite_${nom}.png` });
  B1.push({ id, nom, c, e, quads: q });
}
const b1ok = (r) => r.e && r.e.tipo === 'nextbot' && r.e.nb && r.quads && r.quads.length >= 1 && r.quads.every((x) => x.tx === 'real' && cerca(x.alto, x.ancho, 0.05) && x.ang <= 15 && Math.abs(x.pie) <= 0.3);
ok('B1. los nextbots de Cartman (clase con mayúsculas) y el de Kenny salen como su nextbot, con su sprite real, cuadrado, parado (≤ 15°) y en el piso', B1.every(b1ok), B1.map((r) => ({ nom: r.nom, clase: r.c, e: r.e, quad: r.quads && r.quads[0], ok: b1ok(r) })));
await ev(limpiar);

// ---------- B: la malla dibujada, medida ----------
// (cada vértice con su piel —la matriz de cada hueso por su pose de enlace—, en los ejes de la entidad: alto, ancho y fondo
// de todo y del cuerpo sin los brazos; la cadera y la cabeza; y lo mismo en la pose de enlace del .mdl)
await ev(`window.__malla = (M, pv, W, W0) => {
  const V = M.v, H = M.huesos, brazo = H.map((h) => /arm|hand|finger|clavicle|anim_attach|forward/i.test(h.n));
  const inv = W0 ? [W0[0], W0[4], W0[8], W0[1], W0[5], W0[9], W0[2], W0[6], W0[10]] : null, o = W0 ? [W0[12], W0[13], W0[14]] : [0, 0, 0];
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], tmn = [1e9, 1e9, 1e9], tmx = [-1e9, -1e9, -1e9], bmn = [1e9, 1e9, 1e9], bmx = [-1e9, -1e9, -1e9], tbmn = [1e9, 1e9, 1e9], tbmx = [-1e9, -1e9, -1e9];
  let ymin = 1e9;
  for (let k = 0; k < V.n; k++) {
    const x0 = V.pos[k * 3], y0 = V.pos[k * 3 + 1], z0 = V.pos[k * 3 + 2]; let px = 0, py = 0, pz = 0, wt = 0, conBrazo = false;
    for (let j = 0; j < 3; j++) { const w = V.w[k * 3 + j]; if (!(w > 0)) continue; const hb = V.hb[k * 3 + j], m = H[hb].p2b, A = W[1 + hb]; if (!A) continue; if (brazo[hb]) conBrazo = true;
      const l = pv([m[0] * x0 + m[1] * y0 + m[2] * z0 + m[3], m[4] * x0 + m[5] * y0 + m[6] * z0 + m[7], m[8] * x0 + m[9] * y0 + m[10] * z0 + m[11]]);
      px += w * (A[0] * l[0] + A[4] * l[1] + A[8] * l[2] + A[12]); py += w * (A[1] * l[0] + A[5] * l[1] + A[9] * l[2] + A[13]); pz += w * (A[2] * l[0] + A[6] * l[1] + A[10] * l[2] + A[14]); wt += w; }
    if (!(wt > 0)) continue; px /= wt; py /= wt; pz /= wt; if (py < ymin) ymin = py;
    const d = [px - o[0], py - o[1], pz - o[2]], q = inv ? [inv[0] * d[0] + inv[1] * d[1] + inv[2] * d[2], inv[3] * d[0] + inv[4] * d[1] + inv[5] * d[2], inv[6] * d[0] + inv[7] * d[1] + inv[8] * d[2]] : d;
    const r = pv([x0, y0, z0]);
    for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], q[c]); mx[c] = Math.max(mx[c], q[c]); bmn[c] = Math.min(bmn[c], r[c]); bmx[c] = Math.max(bmx[c], r[c]); if (!conBrazo) { tmn[c] = Math.min(tmn[c], q[c]); tmx[c] = Math.max(tmx[c], q[c]); tbmn[c] = Math.min(tbmn[c], r[c]); tbmx[c] = Math.max(tbmx[c], r[c]); } }
  }
  const hp = (re) => { const i = H.findIndex((h) => re.test(h.n)); return i >= 0 && W[1 + i] ? [W[1 + i][12], W[1 + i][13], W[1 + i][14]] : null; };
  const cad = hp(/pelvis$/i), cab = hp(/head1?$/i); let ang = null; if (cad && cab) { const v = [cab[0] - cad[0], cab[1] - cad[1], cab[2] - cad[2]], l = Math.hypot(...v); ang = l > 1e-4 ? Math.acos(Math.max(-1, Math.min(1, v[1] / l))) * 180 / Math.PI : null; }
  const r3 = (a) => a.map((x) => +x.toFixed(3)), ext = (a, z) => [0, 1, 2].map((c) => z[c] - a[c]);
  return { alto: +(mx[1] - mn[1]).toFixed(3), altoEnlace: +(bmx[1] - bmn[1]).toFixed(3), cuerpo: r3(ext(tmn, tmx)), cuerpoEnlace: r3(ext(tbmn, tbmx)), ymin: +ymin.toFixed(3), ymax: +(mx[1] + o[1]).toFixed(3), ang: ang == null ? null : +ang.toFixed(1) };
}; 1`);
const SP3D = [['3832733494', 'models/docodummy/southpark/eric.mdl', 'cartman_doco'], ['3832670573', 'models/docodummy/southpark/kenny.mdl', 'kenny_doco'], ['1878108687', 'models/hellinspector/southpark/cartman_pm.mdl', 'cartman_n64'], ['370144942', 'models/kenny/kenny.mdl', 'kenny_npc']];
for (const [id] of SP3D) inst[id] = await INST(id);
for (const [, m] of SP3D) await ev(`new Promise((ok) => { if (!gmModeloEsperar('gm:${m}', () => ok(1))) ok(0); setTimeout(() => ok(2), 8000); })`);
// B2: como nextbots de DrGBase (una clase de prueba por modelo, sin IA: quietos) y como NPC
await lua(`local M = {${SP3D.map((x) => JSON.stringify(x[1])).join(',')}} for i, m in ipairs(M) do local ENT = {} ENT.Base = "drgbase_nextbot" ENT.Type = "nextbot" ENT.PrintName = "SP" .. i ENT.Category = "SP" ENT.Models = {m} ENT.Folder = "entities/npc_ev6_sp" .. i scripted_ents.Register(ENT, "npc_ev6_sp" .. i) end return #M`);
const B2 = [];
for (let i = 0; i < SP3D.length; i++) {
  const [, m, nom] = SP3D[i], cls = 'npc_ev6_sp' + (i + 1);
  await ev(limpiar); await p.waitForTimeout(200);
  await ev(`(() => { JUG.pitch = 0.32; return 1; })()`);
  await poner(cls, 2.6); await lua(`local e = ents.FindByClass('${cls}')[1] if IsValid(e) then e:DisableAI() e:SetAngles(Angle(0, 180, 0)) end return 1`);
  await esperarModelo(cls, 6000); await p.waitForTimeout(1200);
  const r = await ev(`(() => { const e = ${ent(cls)}; if (!e || !e.nbW) return null; const d = gmnbDef(e); return Object.assign(window.__malla(d.M, d.pv, e.nbW, e.nbW[0]), { piso: +gmaEntPos(e).y.toFixed(3), sec: e.nbSec ? d.M.secuencias[e.nbSec.i].n : null }); })()`);
  await p.screenshot({ path: `${D}/ev6_B2_nextbot_${nom}.png` });
  B2.push(Object.assign({ m: nom, como: 'nextbot' }, r || { sin: true }));
  await ev(limpiar); await p.waitForTimeout(200);
  await ev(`(() => { JUG.pitch = 0.32; window.__P = npcCrear('gmpm:${m}', v3(0, ${PISO}, 2.6), Math.PI, { modo: 'quieto' }); return !!window.__P; })()`);
  await p.waitForTimeout(2600);
  const q = await ev(`(() => { const P = window.__P, G = P && P.gmp; if (!G || G.propio) return null; return Object.assign(window.__malla(G.def.M, G.def.pv, G.W, G.W[0]), { piso: ${PISO} }); })()`);
  await p.screenshot({ path: `${D}/ev6_B2_npc_${nom}.png` });
  B2.push(Object.assign({ m: nom, como: 'npc' }, q || { sin: true }));
}
// (el ancho y el fondo del cuerpo, de mayor a menor: la pose de enlace de los modelos de jugador está girada 90° respecto de
// cómo los ponen sus animaciones)
const hor = (c) => [c[0], c[2]].sort((x, y) => y - x);
const b2ok = (r) => r && !r.sin && cerca(r.alto, r.altoEnlace, 0.15) && cerca(hor(r.cuerpo)[0], hor(r.cuerpoEnlace)[0], 0.15) && cerca(hor(r.cuerpo)[1], hor(r.cuerpoEnlace)[1], 0.25) && r.ang !== null && r.ang <= 15 && Math.abs(r.ymin - r.piso) <= Math.max(0.06, 0.03 * r.alto);   // (los pies: ±6 cm o el 3 % del alto)
ok('B2. Cartman y Kenny 3D como nextbots de DrGBase y como NPC: alto y ancho del cuerpo como en su pose de enlace (±15 %), parados (≤ 15°) y en el piso (±6 cm o 3 % del alto)', B2.length === 8 && B2.every(b2ok), B2.map((r) => ({ m: r.m, como: r.como, sec: r.sec, alto: [r.alto, r.altoEnlace], cuerpo: r.cuerpo && [hor(r.cuerpo), hor(r.cuerpoEnlace)], ang: r.ang, pie: r.ymin != null ? +(r.ymin - r.piso).toFixed(3) : null, ok: b2ok(r) })));
// B3: como muñeco de trapo (Props → Mods)
const B3 = [];
for (const [, m, nom] of SP3D) {
  await ev(limpiar); await p.waitForTimeout(300);
  await ev(`(() => { JUG.pitch = 0.5; return 1; })()`); await p.waitForTimeout(200);   // (la cámara ya mirando abajo: cae a 2,5 m)
  await ev(`(() => { window.__P = gmragModelo('${m}'); return !!window.__P; })()`);
  await p.waitForTimeout(3500);
  const r = await ev(`(() => { const P = window.__P, G = P && P.gmp; if (!G || !P.rag) return null; const x = window.__malla(G.def.M, G.def.pv, G.W, null), c = P.pos, h = mundoRayo(v3(c.x, c.y + 3, c.z), v3(0, -1, 0), 30); x.piso = h ? +(c.y + 3 - h.t).toFixed(3) : null; return x; })()`);
  // (la cámara mirando al muñeco)
  if (r) await ev(`(() => { const c = window.__P.pos, d = vsub(c, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); return 1; })()`);
  await p.waitForTimeout(400); await p.screenshot({ path: `${D}/ev6_B3_muneco_${nom}.png` });
  B3.push(Object.assign({ m: nom }, r || { sin: true }));
}
const b3ok = (r) => r && !r.sin && r.piso !== null && r.ymin >= r.piso - 0.03 && r.ymin <= r.piso + 0.15 && r.ymax - r.ymin > 0.08;
ok('B3. los mismos como muñeco de trapo: la malla sobre el piso (lo más bajo entre −3 y +15 cm del piso)', B3.length === 4 && B3.every(b3ok), B3.map((r) => ({ m: r.m, bajo: r.ymin != null && r.piso != null ? +(r.ymin - r.piso).toFixed(3) : null, alto: r.ymax != null ? +(r.ymax - r.ymin).toFixed(3) : null, ok: b3ok(r) })));
await ev(limpiar);

// ---------- C ----------
const le = await ev(`GMA.errores.slice(${lua0}).map((x) => String(x.msg || x).slice(0, 200)).slice(0, 5)`);
const ej = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('C. sin errores de Lua ni de JS', !le.length && !ej.length && Object.values(inst).every((x) => !x.err.length), { lua: le, js: ej.slice(0, 4), inst: Object.fromEntries(Object.entries(inst).map(([k, x]) => [k, x.err])) });
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close(); process.exit(R0.every(Boolean) ? 0 : 1);
