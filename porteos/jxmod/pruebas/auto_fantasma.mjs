// autos que chocan contra nada: en cada mapa, un Sedan arranca en varios lugares y direcciones con el acelerador a fondo
// (8 s cada uno, a 60 cuadros simulados por segundo) y se anota cada frenazo (pierde más de 3 m/s en 0,1 s) sin nada
// adelante (una grilla de rayos que cubre el frente del auto no ve nada a menos de 3,5 m) ni un choque de verdad (ver
// abajo), con quién lo frenó (los contactos del chasis en los últimos 8 cuadros). Fantasma = contacto con una normal
// que no es la de la cara del triángulo (arista interna o margen especulativo). Criterio: 0 frenazos fantasma.
// uso: node auto_fantasma.mjs URL_HTML [MAPAS separados por coma]
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2]);
const MAPAS = (process.argv[3] || 'FlatGrass,Desert,RB_Colinas,RB_Llanura,RB_Construct,RB_Flatgrass,RB_Isla,RB_Desierto').split(',');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); 1`);
const tot = {};
for (const m of MAPAS) {
  await ev(`empezarPartida('${m}'); 1`);
  await p.waitForFunction((mm) => window.__ev(`MUNDO.nombre === '${mm}' && JUEGO.estado === 'juego'`), m, { timeout: 90000 });
  await p.waitForTimeout(2500);
  const r = await ev(`(async () => {
    const res = { pruebas: 0, fantasmas: [], reales: 0 }, sp = MUNDO.spawns.length ? MUNDO.spawns : [v3(0, 5, 0)];
    const lugares = []; for (let k = 0; k < 6; k++) { const s = sp[k % sp.length]; lugares.push(v3(s.x + (k - 3) * 9, s.y, s.z + ((k * 7) % 5 - 2) * 9)); }
    const PASO = 1 / 60, ent = { x: 0, y: 1, saltar: false, correr: false };
    for (const L of lugares) for (const yaw of [0, 1.6, 3.2, 4.7]) {
      const piso = pisoBajo(v3(L.x, L.y + 30, L.z), 80); if (piso === null) continue;
      const o = crearObjeto('Sedan', v3(L.x, piso + 1.2, L.z), Quat.axis(0, 1, 0, yaw), {}); if (!o || !o.veh) continue; res.pruebas++;
      const B = o.b, hist = [], cont = [], ruedas = []; let antes = 0;
      for (let i = 0; i < 480; i++) {
        autoPaso(o.veh, PASO, i > 30 ? ent : null); physStep(PASO);
        const f = B.q.rot(v3(0, 0, 1)), v = vdot(B.vel, f); hist.push(v);
        cont[i % 8] = PH.contacts.filter((c) => (c.A === B || c.B === B) && (c.active || c.hit)).map((c) => { const o2 = c.A === B ? c.B : c.A;
          if (!o2) return { t: 'suelo', real: true }; if (o2.tri === undefined) return { t: o2.obj ? 'obj ' + o2.obj.nombre : 'caja ' + (o2.nodo || o2.shape.type), real: true };
          const cara = Math.abs(vdot(c.n, o2.tn)) > 0.97; return { t: 'tri' + o2.tri + ' tn.y ' + o2.tn.y.toFixed(2) + ' n ' + [c.n.x, c.n.y, c.n.z].map((x) => x.toFixed(2)) + ' d ' + c.depth.toFixed(2), cara, pared: cara && Math.abs(o2.tn.y) < 0.7, contra: cara && vdot(c.n, f) < -0.3, hondo: cara && c.depth > 0.2 }; });
        ruedas[i % 8] = o.veh.ruedas.filter((w) => w.toca).length;
        if (i > 60 && hist[i - 6] - v > 3) {
          // ¿hay algo adelante? (rayo a la altura del paragolpes, y otro más bajo)
          // (una grilla de rayos que cubre todo el frente del auto: de abajo del paragolpes al techo y de punta a punta, y en diagonal)
          const r = B.q.rot(v3(1, 0, 0)), u = B.q.rot(v3(0, 1, 0)), sh = B.shape.type === 'hull' ? B : (B.hijos || [B])[0];
          let mx = 0, my0 = 9, my1 = -9, mz = 0; for (const H of B.hijos || [B]) for (const w of H.wv || []) { const d = vsub(w, B.pos); mx = Math.max(mx, Math.abs(vdot(d, r))); mz = Math.max(mz, vdot(d, f)); my0 = Math.min(my0, vdot(d, u)); my1 = Math.max(my1, vdot(d, u)); }
          let algo = false;
          for (const y of [my0 - 0.12, my0 + 0.05, (my0 + my1) / 2, my1 - 0.05]) for (const x of [-mx, -mx / 2, 0, mx / 2, mx]) for (const g of [0, 0.4, -0.4]) {
            const dir = vadd(vscale(f, Math.cos(g)), vscale(r, Math.sin(g) * Math.sign(x || 1))).norm(), o2 = vadd(vadd(B.pos, vscale(r, x)), vadd(vscale(u, y), vscale(f, mz - 0.3)));
            const h = raycast(o2, dir, 3.5, B); if (h && h.n.y < 0.7) algo = true;
          }
          const cs = PH.contacts.filter((c) => c.A === B || c.B === B).map((c) => { const o2 = c.A === B ? c.B : c.A; if (!o2) return "suelo"; return o2.tri !== undefined ? 'tri(n.y ' + (o2.tn ? Math.abs(o2.tn.y).toFixed(2) : '?') + ', cn.y ' + c.n.y.toFixed(2) + ')' : o2.obj ? 'obj ' + o2.obj.nombre : o2.shape.type; });
          const por = [], cs8 = []; for (let k = 0; k < 8; k++) for (const x of cont[(i - k + 8) % 8] || []) { por.push(x.t); cs8.push(x); }
          // también es de verdad: una pared (contacto con la cara de un triángulo parado), una caja u objeto del mapa, caer
          // de un salto sobre el piso (las ruedas en el aire y el contacto con la cara), una subida empinada de frente (la cara
          // empuja para atrás) o quedar encajado (la cara metida más de 20 cm, como debajo de una mesa)
          const enAire = Math.min(...ruedas) === 0;
          if (cs8.some((x) => x.real || x.pared || x.contra || x.hondo || (enAire && x.cara))) algo = true;
          if (!algo) res.fantasmas.push({ yaw, en: [Math.round(B.pos.x), Math.round(B.pos.y), Math.round(B.pos.z)], v: +hist[i - 6].toFixed(1), a: +v.toFixed(1), up: +B.q.rot(v3(0, 1, 0)).y.toFixed(2), ruedas: ruedas.slice(), por: [...new Set(por)].slice(0, 5) }); else res.reales++;
          hist[i] = hist[i - 6];   // (para no contar el mismo frenazo seis veces)
          i += 30;
        }
      }
      borrarObjeto(o, true);
    }
    return res; })()`);
  tot[m] = r;
  console.log(m, 'pruebas', r.pruebas, 'fantasmas', r.fantasmas.length, 'reales', r.reales, JSON.stringify(r.fantasmas.slice(0, 4)));
}
const n = Object.values(tot).reduce((s, r) => s + r.fantasmas.length, 0);
ok('ningún frenazo sin nada adelante', n === 0, Object.fromEntries(Object.entries(tot).map(([k, r]) => [k, r.fantasmas.length + '/' + r.pruebas])));
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 3));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
