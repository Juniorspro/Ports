// colisiones medidas (no a ojo), en el mapa que se elija (MAPA=FlatGrass por defecto, o RB_Construct):
//  A) tiros: una caja y un barril tirados a 15, 40 y 80 m/s contra el piso y contra la pared más cercana no la atraviesan
//     (en ningún paso el centro cruza una superficie del mapa y no terminan más de 15 cm debajo del piso).
//  B) una pila de 5 cajas y 3 barriles: después de 4 s nada se mete en nada más de 3 cm (contactos de verdad del motor).
//  C) el jugador caminando 2 s contra una caja liviana, un auto y una caja congelada: su cuerpo no entra más de 5 cm.
//  D) (con CARPETA_GMA y IDS) lo que dan los addons: hasta 2 props, 2 entidades, 2 NPC y 2 vehículos de cada uno, puestos
//     adelante como desde el menú: 2 s después ninguno quedó más de 15 cm debajo del piso, se fue (NaN o muy lejos) ni se
//     mete más de 5 cm en otra cosa.
// uso: node colisiones.mjs URL_HTML [URL_CARPETA_GMA ARCHIVO_IDS] [SALIDA.json]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, LISTA, SAL = 'colisiones.json'] = process.argv, MAPA = process.env.MAPA || 'FlatGrass';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
let s = null;
const AYUDAS = `
  window.esperaJuego = (q) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + q || performance.now() - r0 > 25000 ? ok() : setTimeout(f, 30)); f(); });
  // lo más metido de cada cuerpo de un grupo en otra cosa, con los contactos del motor (separación < 0 = metido)
  window.metido = (set) => { detect(1 / 60); let m = 0; for (const c of PH.contacts) { const A = c.A.padre || c.A, B = c.B && (c.B.padre || c.B); if (set && !set.has(A) && !(B && set.has(B))) continue;
    const pA = vadd(c.A.pos, c.A.q.rot(c.rA)), pB = c.wB ? c.wB : vadd(c.B.pos, c.B.q.rot(c.rB)), sep = vdot(vsub(pA, pB), c.n); if (-sep > m) m = -sep; } return m; };
  // lo bajo de un cuerpo respecto del piso que tiene debajo (rayo desde arriba)
  window.bajoPiso = (b) => { const a = b.aabb; if (![a.y0, a.y1, b.pos.x, b.pos.y, b.pos.z].every(Number.isFinite)) return null; const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, h = mundoRayo(v3(cx, a.y1 + 2, cz), v3(0, -1, 0), 80); return h ? a.y0 - (a.y1 + 2 - h.t) : 0; };
  window.adelante = (d) => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); return v3(JUG.pos.x + f.x * d, pisoBajo(v3(JUG.pos.x + f.x * d, JUG.pos.y + 3, JUG.pos.z + f.z * d), 12), JUG.pos.z + f.z * d); };
  window.limpiar = () => { for (const o of OBJS.slice()) if (!o.mapa && !o.fijo) borrarObjeto(o); 1; };
  1`;
const nueva = async () => { if (s) await s.b.close().catch(() => {}); s = await abrir(HTML);
  await s.ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida(${JSON.stringify(MAPA)}); 1`); await s.p.waitForTimeout(3000);
  await s.p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 30000 }).catch(() => {}); await s.ev(AYUDAS); await s.ev(`window.__J0 = [JUG.pos.x, JUG.pos.y, JUG.pos.z, JUG.yaw]; 1`); };
const alInicio = () => s.ev(`JUG.pos.set(__J0[0], __J0[1], __J0[2]); JUG.vel.set(0, 0, 0); JUG.yaw = __J0[3]; JUG.pitch = 0.3; limpiar(); 1`);
await nueva();
console.log('mapa', MAPA);
// ---- A) tiros ----
const tiros = await s.ev(`(async () => {
  const out = [];
  // la pared más cercana (rayos horizontales a la altura del pecho, normal casi horizontal)
  let pared = null; const o = v3(JUG.pos.x, JUG.pos.y + 0.6, JUG.pos.z);
  for (let i = 0; i < 32; i++) { const a = i / 32 * 2 * Math.PI, d = v3(Math.sin(a), 0, Math.cos(a)), h = mundoRayo(o, d, 3000); if (!h || h.t < 6) continue; const n = h.n ? v3(h.n.x, h.n.y, h.n.z) : vscale(d, -1); if (Math.abs(n.y) > 0.3) continue; if (!pared || h.t < pared.t) pared = { t: h.t, p: vadd(o, vscale(d, h.t)), n, d }; }
  for (const nom of ['Box4', 'Barrel']) for (const v of [15, 40, 80]) for (const como of ['piso', 'pared']) {
    if (como === 'pared' && !pared) continue;
    limpiar(); let p0, vel;
    if (como === 'piso') { p0 = adelante(4); p0.y += 2.5; vel = v3(0, -v, 0); } else { p0 = vadd(pared.p, vscale(pared.n, 3)); vel = vscale(pared.n, -v); }
    const ob = crearObjeto(nom, p0, new Quat()); if (!ob) { out.push({ nom, v, como, puesto: false }); continue; }
    const b = ob.b; b.wake(); b.vel.copy(vel);
    // (paso a paso: si en un paso el centro del cuerpo cruza una superficie del mapa, la atravesó)
    let cruza = 0; for (let i = 0; i < 120; i++) { const q0 = b.pos.clone(); physStep(1 / 60); const d = vsub(b.pos, q0), L = d.len(); if (L > 1e-4 && mundoRayo(q0, vscale(d, 1 / L), L)) cruza++; }
    const bajo = bajoPiso(b), lado = como === 'pared' ? vdot(vsub(b.pos, pared.p), pared.n) : null;
    out.push({ nom, v, como, cruza, bajo: bajo === null ? null : +bajo.toFixed(2), lado: lado === null ? null : +lado.toFixed(2), metido: +metido(new Set([b])).toFixed(3) });
  }
  limpiar(); return { pared: pared && { t: +pared.t.toFixed(1), n: [pared.n.x, pared.n.y, pared.n.z].map((x) => +x.toFixed(2)) }, out };
})()`);
const tMal = tiros.out.filter((t) => t.puesto === false || t.bajo === null || t.bajo < -0.15 || t.cruza > 0 || t.metido > 0.05);
ok(`A) tiros a 15/40/80 m/s contra el piso y la pared: nada la atraviesa (${tiros.out.length - tMal.length}/${tiros.out.length})`, !tMal.length && tiros.out.length >= 6, { pared: tiros.pared, mal: tMal, todos: tiros.out.map((t) => `${t.nom}${t.v}${t.como[0]}:${t.cruza}/${t.bajo}/${t.lado}/${t.metido}`) });
// ---- B) pila ----
await alInicio();
const pila = await s.ev(`(async () => { const p = adelante(5), L = [];
  for (let i = 0; i < 5; i++) L.push(crearObjeto('Box4', v3(p.x + (i % 2) * 0.1, p.y + 0.6 + i * 1.3, p.z), Quat.axis(0, 1, 0, i * 0.4)));
  for (let i = 0; i < 3; i++) L.push(crearObjeto('Barrel', v3(p.x + 2.5, p.y + 0.8 + i * 1.6, p.z + (i % 2) * 0.15), new Quat()));
  const B = new Set(L.filter(Boolean).map((o) => o.b)); await esperaJuego(4);
  const m = metido(B), bajos = [...B].map(bajoPiso); limpiar(); return { n: B.size, metidoCm: +(m * 100).toFixed(1), peorBajo: +Math.min(...bajos.map((x) => (x === null ? -99 : x))).toFixed(2) }; })()`);
ok('B) pila de 5 cajas y 3 barriles: nada se mete más de 3 cm ni queda bajo el piso', pila.n === 8 && pila.metidoCm <= 3 && pila.peorBajo >= -0.15, pila);
// ---- C) el jugador contra cosas ----
for (const [nom, congelar] of [['Box4', false], ['Sedan', false], ['Crate', true]]) {
  await alInicio();
  const r = await s.ev(`(async () => { const p = adelante(3.2); const ob = crearObjeto('${nom}', v3(p.x, p.y + 1.2, p.z), Quat.axis(0, 1, 0, JUG.yaw)); if (!ob) return { puesto: false };
    await esperaJuego(1.2); { const a = ob.b.aabb, f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), med = Math.abs(f.x) * (a.x1 - a.x0) / 2 + Math.abs(f.z) * (a.z1 - a.z0) / 2, falta = JUG.radio + 1.5 + med - Math.hypot(ob.b.pos.x - JUG.pos.x, ob.b.pos.z - JUG.pos.z); JUG.pos.addS(f, -falta); } if (${congelar}) { ob.b.frozen = true; ob.b.vel.set(0, 0, 0); ob.b.ang.set(0, 0, 0); }
    JUG.yaw = Math.atan2(ob.b.pos.x - JUG.pos.x, ob.b.pos.z - JUG.pos.z);
    let peor = 0; const t0 = TIEMPO.t;
    ENT.teclas.add('KeyW'); const pi = JUG.pos.clone(); while (TIEMPO.t < t0 + 2) { await new Promise((r) => setTimeout(r, 20));
      for (const [dy] of JUG.esf) { const c = v3(JUG.pos.x, JUG.pos.y + dy, JUG.pos.z), bs = ob.b.hijos || [ob.b];
        for (const b of bs) { if (b.shape.type !== 'hull') continue; const h = hullClosest(b, c); const pen = h.inside ? JUG.radio + h.d : JUG.radio - Math.hypot(c.x - h.p.x, c.y - h.p.y, c.z - h.p.z); if (pen > peor) peor = pen; } } }
    ENT.teclas.delete('KeyW'); const mov = Math.hypot(ob.b.pos.x - p.x, ob.b.pos.z - p.z), anduvo = Math.hypot(JUG.pos.x - pi.x, JUG.pos.z - pi.z); borrarObjeto(ob); return { peorCm: +(peor * 100).toFixed(1), anduvo: +anduvo.toFixed(2), movido: +mov.toFixed(2) }; })()`);
  ok(`C) el jugador contra ${nom}${congelar ? ' congelada' : ''}: no se mete más de 5 cm (y caminó hasta tocarlo)`, r.peorCm !== undefined && r.peorCm <= 5 && r.anduvo > 0.8, r);
}
// ---- D) lo que dan los addons ----
if (CARP && LISTA) {
  const ids = fs.readFileSync(LISTA, 'utf8').split(/[\s,]+/).filter(Boolean), res = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]; let r;
    try {
      await alInicio();
      r = await s.ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b);
        gmMenu(); const C = DATA.menu.find((c) => c.n === 'GMod'), it = C ? C.sub.flatMap((x) => x.it) : [], props = gmPropsMenu(A).map((m) => 'gm:' + m);
        const tipos = { prop: props.slice(0, 2), ent: it.filter((x) => /^gment:/.test(x) && A.clases && A.clases.includes ? true : /^gment:/.test(x)).slice(0, 2), npc: it.filter((x) => /^gmnpc:/.test(x)).slice(0, 2), veh: it.filter((x) => /^gmveh:/.test(x)).slice(0, 2) };
        const out = { id: '${id}', n: A.nombre, cosas: [] };
        for (const [tipo, L] of Object.entries(tipos)) for (const x of L) {
          JUG.pos.set(__J0[0], __J0[1], __J0[2]); JUG.yaw = __J0[3]; JUG.pitch = 0.35; JUG.vel.set(0, 0, 0); await esperaJuego(0.1);
          const b0 = new Set(PH.bodies), p0 = new Set(PERS);
          try { spawnElegir('GMod', x); } catch (e) { out.cosas.push({ tipo, x, err: String(e.message || e).slice(0, 80) }); continue; }
          await esperaJuego(2);
          const nb = PH.bodies.filter((b) => !b0.has(b) && b.dynamic), np = PERS.filter((P) => !p0.has(P));
          const bajos = nb.map(bajoPiso), lejos = nb.filter((b) => b.pos.distTo(JUG.pos) > 60).length;
          const pb = np.map((P) => { const h = mundoRayo(v3(P.pos.x, P.pos.y + 2, P.pos.z), v3(0, -1, 0), 80); return h ? P.pos.y - (P.pos.y + 2 - h.t) : 0; });
          out.cosas.push({ tipo, x: x.replace(/^.*[\\/:]/, ''), cuerpos: nb.length, gente: np.length, peorBajo: nb.length ? +Math.min(...bajos.map((v) => (v === null ? -99 : v))).toFixed(2) : null, pies: pb.length ? +Math.min(...pb).toFixed(2) : null, lejos, metidoCm: nb.length ? +(metido(new Set(nb.map((b) => b.padre || b))) * 100).toFixed(1) : 0 });
          for (const P of np) { try { borrarPersona(P); } catch (e) {} }
          limpiar(); if (GMA.ents) for (const e of [...GMA.ents.values()]) { try { if (e.creador === GMA.jug) gmaQuitar(e); } catch (er) {} }
        }
        gmQuitar('${id}'); return out; })()`);
    } catch (e) { r = { id, error: String(e.message || e).slice(0, 140) }; await nueva(); }
    r.mal = (r.cosas || []).filter((c) => c.peorBajo !== null && c.peorBajo < -0.15 || c.pies !== null && c.pies < -0.15 || c.lejos > 0 || c.metidoCm > 5);
    res.push(r); console.log(`${r.mal.length ? 'FALLA' : 'OK   '} ${id} ${r.n || ''} cosas ${(r.cosas || []).length} mal ${r.mal.length}${r.error ? ' ' + r.error : ''} ${r.mal.length ? JSON.stringify(r.mal) : ''}`);
    if ((i + 1) % 15 === 0) await nueva();
    fs.writeFileSync(SAL, JSON.stringify(res, null, 1));
  }
  const T = res.flatMap((x) => x.cosas || []), M = res.flatMap((x) => x.mal || []);
  ok(`D) lo que dan los addons queda sobre el piso y sin meterse (${T.length - M.length}/${T.length}; con error ${res.filter((x) => x.error).length})`, !M.length, M.slice(0, 6));
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await s.b.close(); process.exit(0);
