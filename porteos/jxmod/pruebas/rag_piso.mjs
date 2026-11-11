// El muñeco de trapo no queda con una parte metida en el piso (Discord: «la pierna se traba en el piso»; fisica.js, lados
// del muñeco). N tiradas por mapa con semilla: personajes de varios tamaños, de 2 cm a 12 m de alto, hasta 20 m/s de lado
// y 15 m/s para abajo, con un empujón al azar (como al matarlo de un tiro), sobre piso plano y sobre rampas (mitad y
// mitad), con la física a 60 y a 30 pasos por segundo (la de los celus lentos) y con 5 y 10 subpasos; se simula en el acto
// con physStep. Por cada parte (las esferas de la cápsula, la cabeza, los vértices de las cajas de manos, pies y torso) se
// mide cuánto se mete en el mapa: lo que se superpone con el piso de abajo, lo que está detrás de la cara de un triángulo
// (el primero que se encuentra para arriba mira para arriba: debajo del piso) y lo que está adentro de una caja fija.
// «Trabada»: durante todo el último medio segundo de la tirada (5 s) alguna parte sigue metida más de 1,5 cm (lo que rebota
// y sale no cuenta: va en «en la caída»). Pasa con trabadas ≤ 1 % de las tiradas y ninguna parte con NaN.
// (DBG=i muestra paso a paso la tirada i: cuánto se mete cada parte, su altura, sus contactos y los lados que recuerda)
// (FOTO=i FOTO_SAL=x.png [CELU=1]: la tirada i queda tirada y se le saca una foto desde la cámara del jugador, a 3 m)
// uso: node rag_piso.mjs URL_HTML [MAPA|URL_BSP=RB_Flatgrass] [N=192] [SALIDA.json]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , URL, MAPA = 'RB_Flatgrass', NS = '192', SAL] = process.argv, FOTO = process.env.FOTO === undefined ? -1 : +process.env.FOTO, N = FOTO >= 0 ? FOTO + 1 : +NS;
const { b, p, err, ev } = await abrir(URL, !!process.env.CELU);
if (FOTO < 0) await p.setViewportSize({ width: 320, height: 180 });
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); 1`);
let MK = MAPA;
if (/\.bsp$/.test(MAPA)) { const nom = MAPA.split('/').pop().replace(/\.bsp$/, ''); MK = await ev(`(async () => { const b = new Uint8Array(await (await fetch('${MAPA}')).arrayBuffer()); const r = 'maps/${nom}.bsp'; GMOD.arch.set(r, b); const k = gbspClave(r); GBSP.mapas.set(k, { id: 'sonda', ruta: r, nombre: '${nom}', addon: 'sonda' }); if (!MAPAS_RB.includes(k)) MAPAS_RB.push(k); empezarPartida(k); return k; })()`); }
else await ev(`empezarPartida('${MAPA}'); 1`);
await p.waitForFunction((m) => window.__ev(`MUNDO.nombre === '${m}' && JUEGO.estado === 'juego' && JUG.suelo`), MK, { timeout: 240000, polling: 300 });
await p.waitForTimeout(1500);
const r = await ev(`(async () => {
  let sem = 12345; const rnd = () => (sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648;
  // personajes: los que ya están (sin bajar nada) con cuerpos de muñeco; de cada tamaño
  const cand = [...new Set(Object.keys(DATA.tam || {}).concat(['Hero']))].filter((s) => { try { return rbListo(rbDeSkin(s)) && datosSkin(s); } catch (e) { return false; } });
  const tams = cand.map((s) => [s, tamSkin(s).k]).sort((a, b) => a[1] - b[1]);
  const elegidos = []; const q = [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1]; for (const f of q) { const s = tams[Math.min(tams.length - 1, Math.round(f * (tams.length - 1)))]; if (s && !elegidos.includes(s[0])) elegidos.push(s[0]); }
  // lugares
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const T = MUNDO.T; for (let i = 0; i < MUNDO.nt * 9; i += 3) { x0 = Math.min(x0, T[i]); x1 = Math.max(x1, T[i]); z0 = Math.min(z0, T[i + 2]); z1 = Math.max(z1, T[i + 2]); }
  const sp = MUNDO.spawns[0], hs = mundoRayo(v3(sp.x, sp.y + 0.5, sp.z), v3(0, -1, 0), 50), YS = sp.y + 0.5 - (hs ? hs.t : 0.5);
  const planos = [], rampas = [];
  for (let k = 0; k < 6000 && (planos.length < 40 || rampas.length < 40); k++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
    const h = mundoRayo(v3(x, YS + 40, z), v3(0, -1, 0), 80); if (!h || (h.tri === undefined && !(h.caja && !h.caja.dynamic)) || !h.n || h.n.y < 0.6) continue;
    const y = YS + 40 - h.t; if (Math.abs(y - YS) > 30) continue;
    const arriba = mundoRayo(v3(x, y + 0.2, z), v3(0, 1, 0), 12); if (arriba) continue;
    // (alrededor, 2,5 m sin paredes)
    let libre = true; for (let a = 0; a < 8 && libre; a++) { const d = v3(Math.sin(a * 0.785), 0, Math.cos(a * 0.785)); if (mundoRayo(v3(x, y + 0.6, z), d, 2.5)) libre = false; }
    if (!libre) continue;
    const ny = Math.abs(h.n.y);
    if (ny > 0.985) { if (planos.length < 40) planos.push([x, y, z, ny]); } else if (ny < 0.97) { if (rampas.length < 40) rampas.push([x, y, z, ny]); }
  }
  // cuánto se mete cada parte de un cuerpo bajo el piso que tiene debajo
  // (lo metido de una esfera —o un punto, r = 0— en el mapa: 1) tocando un piso de abajo, lo que se superpone; 2) detrás
  // de la cara de un triángulo (el primero que se encuentra para arriba mira para arriba: está adentro del sólido, debajo
  // del piso), hasta esa cara más el radio; 3) adentro de una caja fija del mapa (los pisos de los mapas de Unity))
  const ab = v3(0, -1, 0), ar = v3(0, 1, 0), o = v3(), TN = MUNDO.TN, cer = [];
  const hondo = (qx, qy, qz, r) => {
    let m = 0; o.set(qx, qy, qz);
    const h = mundoRayo(o, ab, r + 0.05);
    if (h && h.tri !== undefined && TN[h.tri * 3 + 1] > 0) { const n = h.n; m = Math.max(m, r - ((qx - qx) * n.x + (qy - (qy - h.t)) * n.y + 0)); }
    const h2 = mundoRayo(o, ar, 2.5);
    if (h2 && h2.tri !== undefined && TN[h2.tri * 3 + 1] > 0) { const nx = TN[h2.tri * 3], ny = TN[h2.tri * 3 + 1], nz = TN[h2.tri * 3 + 2]; m = Math.max(m, h2.t * ny + r); }
    cer.length = 0; mundoCerca(qx - r - 0.01, qy - r - 0.01, qz - r - 0.01, qx + r + 0.01, qy + r + 0.01, qz + r + 0.01, cer);
    for (const H of cer) { if (H.tri !== undefined || H.dynamic || !H.shape || H.shape.type !== 'hull') continue; H.updateWorld && H.wv || H.updateWorld(); const c = hullClosest(H, o); if (c.inside) m = Math.max(m, r - c.d); else { const L = o.distTo(c.p); if (L < r) m = Math.max(m, r - L); } }
    return m;
  };
  const metido = (b) => {
    const sh = b.shape; b.updateWorld();
    if (sh.type === 'sphere') return hondo(b.pos.x, b.pos.y, b.pos.z, sh.r);
    if (sh.type === 'capsule') { const A = b.capA, B = b.capB; return Math.max(hondo(A.x, A.y, A.z, sh.r), hondo(B.x, B.y, B.z, sh.r), hondo((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, sh.r)); }
    let m = 0; for (const v of b.wv) m = Math.max(m, hondo(v.x, v.y, v.z, 0)); return m;
  };
  const res = []; window.DBGL = []; const t0 = performance.now(); const subAntes = PH.sub;
  JUG.pos.set(sp.x, sp.y + 1, sp.z); JUG.congelado = true;
  for (let i = 0; i < ${N}; i++) {
    const L = (i % 2 ? rampas : planos); if (!L.length) continue; const lug = L[(rnd() * L.length) | 0];
    const skin = elegidos[i % elegidos.length], alto = [0.02, 0.8, 2.5, 6, 12][(rnd() * 5) | 0] + (i % 2 ? 0.35 : 0), vh = rnd() * 20, vy = -rnd() * 15, dt = i % 4 < 2 ? 1 / 60 : 1 / 30, sub = (i >> 2) % 2 ? 10 : 5;
    PH.sub = sub;
    const P = crearPersona(skin, 'HatEmpty', { nombre: 'r' }); P.npc = true;
    P.pos.set(lug[0], lug[1] + 1 + alto, lug[2]); P.yaw = rnd() * 6.283; const a = rnd() * 6.283; P.vel.set(Math.sin(a) * vh, vy, Math.cos(a) * vh);
    // (una pose cualquiera del caminar o el correr, como cuando lo matan andando)
    P.t = rnd() * 10; P.suelo = alto < 0.1; try { personasPaso(0); } catch (e) {}
    ragdoll(P, v3((rnd() - 0.5) * 16, rnd() * 8, (rnd() - 0.5) * 16), P.pos);
    if (!P.rag) { borrarPersona(P); continue; }
    // (si al soltarlo ya hay una parte metida —una rampa empinada bajo un pie—, la tirada no cuenta)
    let ini = 0; for (const [, e] of P.rag.cuerpos) ini = Math.max(ini, metido(e.b)); if (ini > 0.01) { res.push({ i, invalida: true, ini }); borrarPersona(P); continue; }
    const pasos = Math.round(5 / dt), ult = Math.round(0.5 / dt); let maxT = 0; const fin = new Map();
    for (let k = 0; k < pasos; k++) {
      physStep(dt);
      if (i === ${process.env.DBG || -1} && (k % ${process.env.DBGK || 6} === 0 || k > pasos - 3) && k >= ${process.env.DBG0 || 0} && k <= ${process.env.DBG1 || 99999}) { const lin = []; for (const [bi, e] of P.rag.cuerpos) { const m = metido(e.b); if (m > 0.015 || /${process.env.DBGP || 'Hand'}/.test(P.md.A[bi].n)) { const b = e.b, nc = PH.contacts.filter((c) => (c.A === b || c.B === b) && (c.wB || (c.B && !c.B.dynamic))).length; lin.push(P.md.A[bi].n.slice(10) + ' m' + (m * 100).toFixed(1) + ' y' + b.pos.y.toFixed(3) + ' v' + b.vel.y.toFixed(2) + ' c' + nc + ' L' + (b.lados ? [...b.lados.entries()].map(([t, l]) => { const T = MUNDO.T, o = t * 9, tn = MUNDO.triCuerpo[t] && MUNDO.triCuerpo[t].tn; const sd = tn ? (b.pos.x - T[o]) * tn.x + (b.pos.y - T[o + 1]) * tn.y + (b.pos.z - T[o + 2]) * tn.z : 0; return t + ':' + l + '/' + (tn ? tn.y.toFixed(2) : '?') + '/' + sd.toFixed(2) + (triPrisma(t, b.pos, 0.01) ? 'P' : ''); }).join(',') : '-') + (b.sleep ? ' Z' : '')); } } DBGL.push(k + ': ' + lin.join(' | ')); }
      for (const [bi, e] of P.rag.cuerpos) { const m = metido(e.b); if (m > maxT) maxT = m; if (k >= pasos - ult) fin.set(bi, Math.min(fin.has(bi) ? fin.get(bi) : 1e9, m)); }
    }
    let peor = 0, peorN = ''; const partes = {};
    for (const [bi, m] of fin) { const nom = P.md.A[bi].n; partes[nom] = +(m * 100).toFixed(1); if (m > peor) { peor = m; peorN = nom; } }
    const nan = [...P.rag.cuerpos.values()].some((e) => !Number.isFinite(e.b.pos.x));
    res.push({ i, skin, mapaTipo: i % 2 ? 'rampa' : 'plano', ny: +lug[3].toFixed(3), alto, vh: +vh.toFixed(1), vy: +vy.toFixed(1), dt: dt < 0.02 ? 60 : 30, sub, finCm: +(peor * 100).toFixed(1), parte: peorN, maxCm: +(maxT * 100).toFixed(1), nan, partes });
    if (i === ${FOTO}) { window.__ragFoto = P; break; }
    borrarPersona(P);
    if (i % 8 === 7) await new Promise((ok) => setTimeout(ok, 0));
  }
  PH.sub = subAntes; JUG.congelado = !!window.__ragFoto;
  return { dbg: window.DBGL, elegidos, tams: elegidos.map((s) => tamSkin(s).k), planos: planos.length, rampas: rampas.length, ms: Math.round(performance.now() - t0), res };
})()`);
if (FOTO >= 0) {
  // (el jugador a 3 m del muñeco, mirando su cadera; la física sigue andando con el juego)
  await ev(`(() => { const P = window.__ragFoto, h = P.rag.cuerpos.get(P.D.h.Hips).b.pos; const d = v3(2.2, 0, 2.2); JUG.pos.set(h.x + d.x, h.y + 1.3, h.z + d.z); JUG.vel.set(0, 0, 0); JUG.congelado = true;
    const f = vsub(h, v3(JUG.pos.x, JUG.pos.y + 0.6, JUG.pos.z)); JUG.yaw = Math.atan2(f.x, f.z) + Math.PI; JUG.pitch = Math.atan2(-f.y, Math.hypot(f.x, f.z)); return 1; })()`);
  await p.waitForTimeout(1200);
  const al = await ev(`vdot(CAM.fwd, vsub(window.__ragFoto.rag.cuerpos.get(window.__ragFoto.D.h.Hips).b.pos, CAM.pos).norm())`); if (al < 0) await ev(`JUG.yaw += Math.PI; 1`);
  await p.waitForTimeout(1500); fs.writeFileSync(process.env.FOTO_SAL || 'rag_foto.png', await p.screenshot());
}
const INV = r.res.filter((x) => x.invalida).length; r.res = r.res.filter((x) => !x.invalida); const R = r.res, trab = R.filter((x) => x.finCm > 1.5), mx = (L, k) => L.reduce((m, x) => Math.max(m, x[k]), 0);
const pct = (L, k, q) => { const a = L.map((x) => x[k]).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0; };
const resumen = (L) => ({ n: L.length, trabadas: L.filter((x) => x.finCm > 1.5).length, finMax: mx(L, 'finCm'), finP95: pct(L, 'finCm', 0.95), finMedia: +(L.reduce((s, x) => s + x.finCm, 0) / Math.max(1, L.length)).toFixed(2), enCaidaMax: mx(L, 'maxCm'), enCaidaP95: pct(L, 'maxCm', 0.95), nan: L.filter((x) => x.nan).length });
const out = { mapa: MAPA, invalidas: INV, personajes: r.elegidos, tam: r.tams, lugares: [r.planos, r.rampas], ms: r.ms, todo: resumen(R), plano: resumen(R.filter((x) => x.mapaTipo === 'plano')), rampa: resumen(R.filter((x) => x.mapaTipo === 'rampa')), a60: resumen(R.filter((x) => x.dt === 60)), a30: resumen(R.filter((x) => x.dt === 30)) };
// por parte del cuerpo: la peor al final
const porParte = {}; for (const x of R) for (const [k, v] of Object.entries(x.partes)) porParte[k] = Math.max(porParte[k] || 0, v);
out.porParteFinMax = porParte;
out.peores = R.filter((x) => x.finCm > 1.5).sort((a, b) => b.finCm - a.finCm).slice(0, 6).map(({ partes, ...x }) => x);
if (r.dbg.length) console.log(r.dbg.join('\n')); else console.log(JSON.stringify(out, null, 1));
const t = out.todo, bien = t.n > 0 && t.trabadas <= Math.floor(t.n * 0.01) && !t.nan;
console.log((bien ? 'OK   ' : 'FALLA') + ` ${MAPA}: ${t.trabadas}/${t.n} tiradas con una parte trabada bajo el piso (más de 1,5 cm), la peor ${t.finMax} cm; en la caída p95 ${t.enCaidaP95} cm`);
const e2 = err.filter((e) => !/WebSocket|ERR_CONNECTION|404|Failed to load resource/.test(e)); console.log((e2.length ? 'FALLA' : 'OK   ') + ' sin errores de JS' + (e2.length ? ' · ' + JSON.stringify(e2.slice(0, 6)) : ''));
if (SAL) fs.writeFileSync(SAL, JSON.stringify({ out, R }, null, 1));
await b.close();
