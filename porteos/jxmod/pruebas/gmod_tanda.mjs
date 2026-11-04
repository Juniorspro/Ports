// tanda de compatibilidad con addons reales del Workshop (los más suscriptos de armas, entidades, efectos, NPCs y
// vehículos): cada uno se baja de Steam, se instala, se prueba y se saca foto; al final, el % que anda.
// Por addon: errores de Lua al cargar, API que falta, modelos y texturas que no aparecen. Por arma (hasta 3): se da,
// se apunta al piso y se dispara 1 s (primario) y un toque de secundario; anda si la vista se dibuja y el disparo hace
// algo (bala, efecto, partícula, sonido, entidad nueva) sin errores. Por entidad (hasta 3): se pone adelante y anda si
// aparece (con modelo o dibujo propio, sin el damero de "falta") sin errores.
// uso: node gmod_tanda.mjs URL_HTML CARPETA_FOTOS [IDS separados por coma (uno solo: con una coma al final) | N primeros del catálogo]   (WORKER_LOCAL=URL; GMA_DIR=URL de una
// carpeta con los .gma ya bajados: se instalan de ahí)
import { abrir } from './base.mjs';
import fs from 'fs';
const D = (process.argv[3] || '/tmp/tanda') + '/'; fs.mkdirSync(D, { recursive: true });
let ids = (process.argv[4] || '40');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
async function sesion(lista) {
  // (WORKER_LOCAL=http://127.0.0.1:8961: las rutas /api/gmod/* de la tienda van a un worker corriendo en local, para los
  // addons que bajan por SteamPipe antes de desplegarlo)
  const WL = process.env.WORKER_LOCAL;
  const { b, p, err, ev } = await abrir(process.argv[2], false, null, WL ? async (pg) => {
    await pg.route(/workers\.dev\/api\/gmod\//, async (rt) => { const u = new URL(rt.request().url()); try { const r = await fetch(WL + u.pathname + u.search); const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); return rt.fulfill({ status: r.status, headers: h, body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { return rt.abort(); } });
  } : undefined);
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
  // (las esperas son en tiempo del juego: con la máquina cargada los cuadros van lentos y el reloj del juego también)
  await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 20000 ? ok() : setTimeout(f, 30)); f(); }); 1`);
  if (/^\d+$/.test(ids)) {   // (los N primeros del catálogo con armas, entidades, efectos, NPCs o vehículos; sin mapas ni modos de juego)
    const n = +ids; ids = (await ev(`(async () => { const d = await gmCatalogo(); return d.L.filter((x) => x.mb <= 60 && x.tags.some((t) => /^(Weapon|Entity|Effects|NPC|Vehicle|Tool)$/.test(t)) && !x.tags.some((t) => /^(map|Gamemode)$/i.test(t))).slice(0, ${n}).map((x) => x.id).join(','); })()`));
    return ids;
  }
  for (const item of lista) {
    // ("id+dep": la dependencia —lo que el Workshop pide como "Required item", p. ej. la base de los aviones WAC— se instala antes)
    const [id, ...deps] = String(item).split('+');
    // (como «limpiar el mapa» de GMod entre addon y addon: lo que dejó el anterior —una nuclear que sigue explotando 50 s,
    // autos, props— no tiene que empujar ni tapar lo que se prueba ahora)
    await ev(`(async () => { for (const e of [...GMA.ents.values()]) if (e.tipo !== 'jug' && e.tipo !== 'arma') try { gmaQuitar(e); } catch (x) {}
      for (const o of OBJS.slice()) if (o.veh || /#gm$/.test(DATA.pfPorNombre[o.nombre] || '') || /^gm:/.test(o.nombre || '')) try { borrarObjeto(o); } catch (x) {}
      if (typeof npcTodos === 'function') try { npcTodos(); } catch (x) {}
      if (JUG.muerto || Math.hypot(JUG.pos.x, JUG.pos.z) > 30 || !JUG.suelo) try { jugadorAparecer(); } catch (x) {}   // (una explosión lo pudo volar lejos)
      JUG.vel.set(0, 0, 0); await esperaJuego(0.8); return 1; })()`);
    for (const d of deps) await ev(`(async () => { if (GMOD.addons.has('${d}')) return 1; ${process.env.GMA_DIR ? `const rl = await fetch('${process.env.GMA_DIR}/${d}.gma'); const A = rl.ok ? await gmInstalar('${d}', { nombre: '${d}', sinDeps: true }, new Uint8Array(await rl.arrayBuffer())) : await gmInstalar('${d}', { sinDeps: true });` : `const A = await gmInstalar('${d}', { sinDeps: true });`} await A.listo; return 1; })()`).catch(() => 0);
    const r = { id, ok: false, armas: [], ents: [] };
    try {
      await ev(`(() => { window.__e0 = GMA.errores.length; return 1; })()`);
      const ins = await ev(`(async () => { const e0 = GMA.errores.length, f0 = new Set(GMA.faltan ? GMA.faltan.keys() : []); const t0 = performance.now();
        try { ${process.env.GMA_DIR ? `const rl = await fetch('${process.env.GMA_DIR}/${id}.gma');` : 'const rl = null;'} const A = rl && rl.ok ? await gmInstalar('${id}', { nombre: '${id}' }, new Uint8Array(await rl.arrayBuffer())) : await gmInstalar('${id}'); /* (de la carpeta local si está; si no, de Steam como el juego) */ return { n: A.nombre, s: +((performance.now() - t0) / 1000).toFixed(1), sweps: A.sweps || [], sents: A.sents || [], props: A.props.length, luaErr: (A.luaErr || []).slice(0, 4), errs: GMA.errores.slice(e0, e0 + 4), falta: [...(GMA.faltan ? GMA.faltan.keys() : [])].filter((k) => !f0.has(k)).slice(0, 12), faltanMod: (A.faltanModelos || []).length, lib: GML.n, libMB: +(GML.bytes / 1e6).toFixed(1) }; }
        catch (e) { return { e: String(e.message || e) }; } })()`);
      Object.assign(r, ins);
      if (ins.e) { res.push(r); console.log('ADDON', id, 'NO INSTALA', ins.e); continue; }
      // armas
      for (const w of ins.sweps.slice(0, 3)) {
        const x = await ev(`(async () => { const cuenta = (window.__cuenta = { balas: 0, son: 0, ef: 0 }); if (!window.__orig) window.__orig = { fb: gmaBalas, so: sonar, ge: gmaEfecto }; const O = window.__orig; gmaBalas = (...a) => { cuenta.balas++; return O.fb(...a); }; sonar = (...a) => { cuenta.son++; return O.so(...a); }; gmaEfecto = (...a) => { cuenta.ef++; return O.ge(...a); };
          const n0 = GMA.ents.size; gmaSpawnMenu(${JSON.stringify('gmswep:' + w)}); JUG.pitch = 0.35; await esperaJuego(1.6);
          let prim = 0, part = 0, tercera = false; ENT.disparo = true; const t1 = TIEMPO.t, r0 = performance.now(); while (TIEMPO.t < t1 + 1.2 && performance.now() - r0 < 15000) { await new Promise((r) => setTimeout(r, 50)); prim = Math.max(prim, GR.nv); part = Math.max(part, GR.parts.length + PART.l.length); if (JUG.tercera || CAM.pos.distTo(JUG.ojoPos) > 0.5) tercera = true; }
          ENT.disparo = false; return { prim, part, tercera, nuevas: Math.max(0, GMA.ents.size - n0) }; })()`);
        await p.screenshot({ path: D + id + '_' + w + '.png' });
        const y = await ev(`(async () => { ENT.disparo2 = true; await esperaJuego(0.3); ENT.disparo2 = false; await esperaJuego(0.4);
          const D = DEF_ARMAS[${JSON.stringify('gm:' + w)}] || {}; const vista = D.nodo ? 'hl2:' + (D.base || D.nodo) : (ARM.v && ARM.v.gm ? 'propia' : 'ninguna');
          const O = window.__orig; gmaBalas = O.fb; sonar = O.so; gmaEfecto = O.ge;
          return { vista, ...window.__cuenta, errs: GMA.errores.slice(window.__e0 ?? 0) }; })()`);
        r.armas.push({ w, ...x, ...y }); await ev(`(() => { window.__e0 = GMA.errores.length; return 1; })()`);
      }
      // entidades
      for (const s of ins.sents.slice(0, 3)) {
        const x = await ev(`(async () => { const e0 = GMA.errores.length, n0 = GMA.ents.size, id0 = GMA.nid; JUG.pitch = 0.15; gmaSpawnMenu(${JSON.stringify('gment:' + s)}); await esperaJuego(1.5);
          // (la SpawnFunction puede crear otra clase: la escoba "FireStar" pone una kekc_broom_ent)
          const e = [...GMA.ents.values()].filter((e) => e.clase === ${JSON.stringify(s)}).pop() || [...GMA.ents.values()].filter((e) => e.id > id0 && e.tipo === 'ent').pop();
          const falt = e && e.o ? DATA.pf[DATA.pfPorNombre[e.o.nombre]].filter((n) => n.mt).flatMap((n) => n.mt).filter((i) => DATA.mt[i] && DATA.mt[i].t === GMOD.faltante).length : 0;
          return { creada: !!e, modelo: e ? e.modelo : '', cuerpo: !!(e && e.o), caja: !!(e && e.o && e.o.nombre === 'Crate'), oculto: !!(e && e.o && e.o.md.oculto), prim: GR.nv, falt, errs: GMA.errores.slice(e0, e0 + 3) }; })()`);
        await p.screenshot({ path: D + id + '_' + s + '.png' });
        r.ents.push({ s, ...x });
        await ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.clase === ${JSON.stringify(s)}) gmaQuitar(e); return 1; })()`);
      }
      // modelos de jugador (hasta 2): ponérselo y que se arme su modelo (con esqueleto o con sus secuencias)
      r.pms = await ev(`(async () => { const A = GMOD.addons.get('${id}'), L = typeof gmpLista === 'function' ? gmpLista().filter((x) => A.G.archivos.has(x)).slice(0, 2) : [], out = [];
        JUG.tercera = true;   // (el cuerpo propio se dibuja, y se arma su modelo, sólo si se ve)
        for (const m of L) { const e0 = GMA.errores.length; spawnElegir('GMod', 'gmpm:' + m); await esperaJuego(0.6); const P = JUG.cuerpo; out.push({ m, ok: !!(P && P.gmp), propio: !!(P && P.gmp && P.gmp.propio), errs: GMA.errores.slice(e0, e0 + 2) }); }
        JUG.tercera = false; if (L.length) { PREFS.skin = 'Hero'; jugadorCuerpoNuevo(); } return out; })()`);
      // NPCs de la lista (hasta 2): ponerlo y que esté con su modelo
      r.npcs = await ev(`(async () => { const A = GMOD.addons.get('${id}'), L = [...((A.listas && A.listas.NPC) || new Map()).keys()].slice(0, 2), out = [];
        for (const k of L) { const e0 = GMA.errores.length; JUG.pitch = 0.05; const P = gmnpcCrear(k); { const t0 = performance.now(); do await esperaJuego(0.5); while (P && !(P instanceof LEnt) && P.gmpRuta && !P.gmp && performance.now() - t0 < 10000); }   // (el modelo se lee del disco: tarda unos segundos)
          const ok = !!P && (P instanceof LEnt ? entValida(P) : !!(P.gmp || !P.gmpRuta)); out.push({ k, ok, ent: P instanceof LEnt, errs: GMA.errores.slice(e0, e0 + 2) }); }
        npcTodos(); return out; })()`);
      if (r.npcs.length) await p.screenshot({ path: D + id + '_npc.png' });
      // vehículos de la lista (hasta 2): ponerlo, que apoye las ruedas, subirse y acelerar 2 s
      r.vehs = await ev(`(async () => { const A = GMOD.addons.get('${id}'), L = [...((A.listas && A.listas.Vehicles) || new Map()).keys()].slice(0, 2), out = [];
        for (const k of L) { const e0 = GMA.errores.length; JUG.pitch = 0.2; const n0 = OBJS.length; spawnElegir('GMod', 'gmveh:' + k); { const t0 = performance.now(); while (OBJS.length <= n0 && performance.now() - t0 < 10000) { await esperaJuego(0.5); if (OBJS.length <= n0) spawnElegir('GMod', 'gmveh:' + k); } }   // (si el modelo está llegando del disco, se vuelve a pedir)
          const o = OBJS.length > n0 ? OBJS[OBJS.length - 1] : null; const x = { k, puesto: !!(o && o.veh), ruedas: o && o.veh ? o.veh.ruedas.length : 0 };
          if (o && o.veh) { await esperaJuego(1.2); x.tocan = o.veh.ruedas.filter((w) => w.toca).length; if (o.veh.asientos.length) { subirVehiculo(o); ENT.teclas.add('KeyW'); await esperaJuego(2); ENT.teclas.delete('KeyW'); x.vel = +vdot(o.b.vel, o.b.q.rot(v3(0, 0, 1))).toFixed(1); salirVehiculo(); } x.derecho = +o.b.q.rot(v3(0, 1, 0)).y.toFixed(2); x.dbg = { y: +o.b.pos.y.toFixed(2), x: +o.b.pos.x.toFixed(1), z: +o.b.pos.z.toFixed(1), jug: [+JUG.pos.x.toFixed(1), +JUG.pos.y.toFixed(1), +JUG.pos.z.toFixed(1)], vy: +o.b.vel.y.toFixed(2), dormido: !!o.b.dormido, comp: o.veh.ruedas.map((w) => +(w.comp || 0).toFixed(2)) }; borrarObjeto(o); }
          x.errs = GMA.errores.slice(e0, e0 + 2); out.push(x); }
        return out; })()`);
      // props (si no hay otra cosa, hasta 2): que aparezcan y sin texturas que falten
      r.props = !r.armas.length && !r.ents.length && !r.pms.length && !r.npcs.length && !r.vehs.length ? await ev(`(async () => { const A = GMOD.addons.get('${id}'), L = A.props.slice(0, 2), out = [];
        for (const m of L) { JUG.pitch = 0.2; const o = spawnDelante('gm:' + m, {}); await esperaJuego(0.3); const falt = o ? DATA.pf[DATA.pfPorNombre[o.nombre]].filter((n) => n.mt).flatMap((n) => n.mt).filter((i) => DATA.mt[i] && DATA.mt[i].t === GMOD.faltante).length : 0; out.push({ m, ok: !!o, falt }); if (o) borrarObjeto(o); }
        return out; })()`) : [];
      // ¿anda?
      // (un arma anda si se ve y disparar hace algo que se ve: balas, efectos, dibujo propio, partículas o entidades nuevas;
      // sólo un sonido no alcanza)
      // (un arma que se usa en tercera persona —la cámara del addon atrás del jugador, como el sable— se ve en el cuerpo:
      // vale aunque no tenga vista de primera persona)
      const armaOk = (a) => (a.vista !== 'ninguna' || a.tercera) && !a.errs.length && (a.balas + a.ef + a.prim + a.part + (a.nuevas || 0)) > 0;
      const entOk = (e) => e.creada && !e.errs.length && !e.caja && !e.falt;
      const pmOk = (x) => x.ok && !x.errs.length, npcOk = (x) => x.ok && !x.errs.length, vehOk = (x) => x.puesto && x.ruedas >= 2 && x.tocan >= 2 && x.derecho > 0.7 && (x.vel === undefined || x.vel > 2) && !x.errs.length, propOk = (x) => x.ok && !x.falt;
      const probado = r.armas.length + r.ents.length + r.pms.length + r.npcs.length + r.vehs.length + r.props.length;
      r.probado = probado > 0;
      r.ok = probado > 0 && !r.luaErr.length && r.armas.every(armaOk) && r.ents.every(entOk) && r.pms.every(pmOk) && r.npcs.every(npcOk) && r.vehs.every(vehOk) && r.props.every(propOk);
      r.pmsOk = r.pms.filter(pmOk).length; r.npcsOk = r.npcs.filter(npcOk).length; r.vehsOk = r.vehs.filter(vehOk).length;
      r.armasOk = r.armas.filter(armaOk).length; r.entsOk = r.ents.filter(entOk).length;
      console.log('ADDON', id, r.n, !r.probado ? 'SIN PROBAR' : r.ok ? 'ANDA' : 'FALLA', JSON.stringify({ s: r.s, luaErr: r.luaErr, falta: r.falta, faltanMod: r.faltanMod, pms: r.pms.map((x) => [x.m.replace(/^.*\//, ''), x.ok, x.propio, x.errs.length]), npcs: r.npcs.map((x) => [x.k, x.ok, x.errs.length]), vehs: r.vehs.map((x) => [x.k, x.ruedas, x.tocan, x.vel, x.derecho, x.errs.length, ...(process.env.TANDA_DBG ? [x.dbg] : [])]), props: r.props.map((x) => [x.ok, x.falt]), armas: r.armas.map((a) => [a.w, a.vista, a.balas, a.ef, a.son, a.prim, a.part, a.nuevas, a.errs.slice(0, 2)]), ents: r.ents.map((e) => [e.s, e.creada, e.caja, e.falt, e.prim, e.errs.length]) }).slice(0, 900));
      await ev(`(() => { gmDesmontar('${id}'); return 1; })()`);
    } catch (e) { r.e = String(e.message || e); console.log('ADDON', id, 'ERROR DE PRUEBA', r.e.slice(0, 200)); }
    res.push(r);
  }
  const js = err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404|willReadFrequently|\[GMod\]|Failed to load resource/.test(e));
  await b.close();
  return js;
}
if (/^\d+$/.test(ids)) await sesion([]);
const L = ids.split(',').filter(Boolean);
for (let i = 0; i < L.length; i += 6) { const js = await sesion(L.slice(i, i + 6)); if (js.length) console.log('JS:', JSON.stringify(js.slice(0, 3))); }
const okN = res.filter((r) => r.ok).length, sinP = res.filter((r) => !r.e && r.probado === false).length, prob = res.length - sinP;
const suma = (k) => res.reduce((a, r) => a + (r[k] || 0), 0), cuenta = (k) => res.reduce((a, r) => a + ((r[k] || []).length), 0);
fs.writeFileSync(D + 'tanda.json', JSON.stringify(res, null, 1));
console.log(`\nRESUMEN: ${okN}/${prob} addons probados andan (${Math.round(okN / Math.max(1, prob) * 100)} %; ${sinP} sin nada que probar) · armas ${suma('armasOk')}/${cuenta('armas')} · entidades ${suma('entsOk')}/${cuenta('ents')} · modelos de jugador ${suma('pmsOk')}/${cuenta('pms')} · NPCs ${suma('npcsOk')}/${cuenta('npcs')} · vehículos ${suma('vehsOk')}/${cuenta('vehs')}`);
