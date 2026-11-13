// Discord (Gumball): «no funcionan muchas SWEPs». Tanda de armas de los addons más suscriptos del Workshop (packs y
// sueltas: M9K, FA:S, TFA, ArcCW, CW 2.0, CoD, CS:GO, Nyan Gun, Vape, Lightsabers...), cada una con su base, y por arma:
//  - 1ª persona: cuántos píxeles de la pantalla son del arma (foto con y sin la vista del arma) y, de ésos, cuántos son
//    el damero violeta de «falta la textura», negro puro (una bola negra: modelo sin material) o blanco puro;
//  - disparo (1,2 s con el primario): balas (FireBullets), efectos, partículas, sonidos y entidades nuevas;
//  - mira (si el arma tiene: IronSights/Sights/ADS en su tabla o su base): la vista se mueve ≥ 1,5 cm o baja el FOV;
//  - recarga (si tiene cargador): con el cargador casi vacío, al terminar queda lleno;
//  - 3ª persona: píxeles del arma en la mano (foto con el arma y con las manos vacías);
//  - errores de Lua nuevos mientras se usa.
// Anda si: se ve en 1ª (≥ 0,4 % de la pantalla, < 3 % de damero; el negro y el blanco puros se anotan y se miran en las
// fotos: un arma negra o blanca de verdad también los tiene) y en 3ª (≥ 0,02 %), el disparo hace
// algo (y suena, si es de fuego), mira y recarga cuando corresponde, y sin errores de Lua.
// uso: node sweps_tanda.mjs URL_HTML URL_GMA CARPETA_SALIDA [lista: id(+dep)*(:n armas), separados por coma]
//   (URL_GMA: carpeta servida con <id>/<id>.gma). Escribe CARPETA_SALIDA/sweps.json y una foto por arma.
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, GMA, OUT, LISTA] = process.argv; fs.mkdirSync(OUT, { recursive: true });
const DEF = '128089118:2,128091208,128093075,144982052,181283903+180507408,181656972+180507408,299164995,229683363,1244760503,183549197,1076729422+2840031720:2,1750939381+2840031720+2840032487,2131058270+2131057232:2,349050451:2,941003056,123277559,158421055,106565409,116592647,673698301,104607228,827320827,1382102057,316414565,171935748,377152181,417856423,111412589,297646940,336509414';
const lista = (LISTA || process.env.LISTA || DEF).split(',').map((s) => { const [a, n] = s.split(':'); const [id, ...deps] = a.split('+'); return { id, deps, n: +n || 1 }; });
const SAL = OUT + '/sweps.json'; const res = fs.existsSync(SAL) && process.env.SEGUIR ? JSON.parse(fs.readFileSync(SAL, 'utf8')) : [];
let s = null, enSesion = 0;
const nueva = async () => {
  if (s) await s.b.close().catch(() => {});
  s = await abrir(HTML); enSesion = 0;
  await s.p.setViewportSize({ width: 960, height: 540 });   // (la máquina de pruebas está cargada: menos píxeles que dibujar)
  await s.ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 13; DIA.aplicada = -1; 1`);
  await s.p.waitForTimeout(1500); await s.p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 90000 });
  await s.ev(`window.esperaJuego = (t) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + t || performance.now() - r0 > 25000 ? ok() : setTimeout(f, 20)); f(); }); $('hud').classList.add('oc'); 1`);
};
// diferencia entre dos fotos (PNG en base64): píxeles distintos y, de ésos, cuántos son damero violeta, negro o blanco puros
const DIF = `async (a, b, caja) => { const im = async (x) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + x)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0); return { d: g.getImageData(0, 0, bm.width, bm.height).data, w: bm.width, h: bm.height }; };
  const IA = await im(a), A = IA.d, B = (await im(b)).d; let n = 0, vio = 0, neg = 0, bla = 0, tot = 0;
  const x0 = (caja[0] * IA.w) | 0, x1 = (caja[2] * IA.w) | 0, y0 = (caja[1] * IA.h) | 0, y1 = (caja[3] * IA.h) | 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * IA.w + x) * 4; tot++; const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); if (d < 40) continue; n++;
    const r = A[i], g = A[i + 1], bl = A[i + 2]; if (r > 180 && bl > 180 && g < 70) vio++; else if (r < 8 && g < 8 && bl < 8) neg++; else if (r > 245 && g > 245 && bl > 245) bla++; }
  return { pct: +(100 * n / tot).toFixed(3), vio: n ? +(100 * vio / n).toFixed(1) : 0, neg: n ? +(100 * neg / n).toFixed(1) : 0, bla: n ? +(100 * bla / n).toFixed(1) : 0 }; }`;
const foto = async () => (await s.p.screenshot({ type: 'png' })).toString('base64');
const dif = (a, b, caja) => s.p.evaluate(([f, a, b, c]) => eval(f)(a, b, c), [DIF, a, b, caja || [0, 0, 1, 1]]);
const hechos = new Set(res.map((r) => r.addon));
await nueva();
for (const L of lista) {
  if (hechos.has(L.id)) continue;
  if (enSesion >= 3) await nueva();   // (navegador nuevo cada 3 addons: no juntar memoria)
  enSesion++;
  const { ev, p } = s;
  // (como «limpiar el mapa» entre addons y addons anteriores fuera: cada uno se prueba solo con su base)
  try {
    await ev(`(async () => { for (const id of [...GMOD.addons.keys()]) gmQuitar(id); JUG.tercera = false; if (JUG.muerto || !JUG.vivo) try { jugadorAparecer(); } catch (x) {} JUG.pos.set(0, JUG.pos.y, 0); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.12; await esperaJuego(0.5); return 1; })()`);
    for (const d of L.deps) await ev(`(async () => { const b = new Uint8Array(await (await fetch('${GMA}/${d}/${d}.gma')).arrayBuffer()); const A = await gmInstalar('${d}', { nombre: '${d}', sinDeps: true }, b); await A.listo; return 1; })()`);
    const ins = await ev(`(async () => { const e0 = GMA.errores.length; const b = new Uint8Array(await (await fetch('${GMA}/${L.id}/${L.id}.gma')).arrayBuffer()); const A = await gmInstalar('${L.id}', { nombre: '${L.id}', sinDeps: true }, b); await A.listo; await esperaJuego(0.3); if (GMOD.recargaT) await GMOD.recarga;   /* (un addon con agregados de otro: el Lua de todos se vuelve a cargar) */
      return { nombre: A.G.nombre || A.nombre, sweps: A.sweps || [], luaErr: (A.luaErr || []).slice(0, 6), errLua: GMA.errores.slice(e0, e0 + 6).map((x) => String(x.msg || x).slice(0, 200)) }; })()`);
    // (las armas: la primera y, en los packs, otra del medio de la lista)
    const W = ins.sweps.length ? [...new Set([ins.sweps[0], ins.sweps[Math.floor(ins.sweps.length / 2)], ins.sweps[ins.sweps.length - 1]])].slice(0, L.n) : [];
    if (!W.length) { res.push({ addon: L.id, nombre: ins.nombre, arma: null, anda: false, motivo: 'no registra armas', ...ins }); console.log('ADDON', L.id, ins.nombre, 'SIN ARMAS', JSON.stringify(ins.luaErr)); fs.writeFileSync(SAL, JSON.stringify(res, null, 1)); continue; }
    for (const w of W) {
      const r = { addon: L.id, nombre: ins.nombre, arma: w, luaErrAddon: ins.luaErr.length };
      await ev(`(async () => { window.__e0 = GMA.errores.length; JUG.tercera = false; JUG.yaw = 0; JUG.pitch = 0.12; gmaSpawnMenu(${JSON.stringify('gmswep:' + w)}); await esperaJuego(2.2);
        /* (lista para usar: algunas tienen una animación larga la primera vez que se sacan —FA:S, hasta 6 s— y no disparan ni recargan antes, como en GMod) */
        for (let i = 0; i < 40 && GMA.swep && TIEMPO.t < (GMA.swep.nextP || 0); i++) await esperaJuego(0.2); return 1; })()`);
      // 1ª persona: con y sin la vista del arma
      const a1 = await foto(); fs.writeFileSync(`${OUT}/${L.id}_${w}_1p.png`, Buffer.from(a1, 'base64'));
      await ev(`(async () => { window.__dv = dibujarVista; dibujarVista = () => false; await esperaJuego(0.15); return 1; })()`);
      const b1 = await foto(); await ev(`(() => { dibujarVista = window.__dv; return 1; })()`);
      r.vista1 = await dif(a1, b1, [0, 0.3, 1, 1]);
      r.tipoVista = await ev(`(() => { const D = DEF_ARMAS[${JSON.stringify('gm:' + w)}] || {}; return D.nodo ? 'hl2' : (GMA.swep && GMA.swep.clase === ${JSON.stringify(w)} ? 'propia' : 'ninguna'); })()`);
      // disparo
      const dsp = await ev(`(async () => { const c = (window.__c = { balas: 0, son: 0, ef: 0, part: 0, ents: 0, gesto: 0 }); if (!window.__orig) window.__orig = { fb: gmaBalas, so: sonar, ge: gmaEfecto, st: gmsnTocar, ha: humAccion }; const O = window.__orig;
        gmaBalas = (...a) => { c.balas++; return O.fb(...a); }; sonar = (...a) => { c.son++; return O.so(...a); }; gmaEfecto = (...a) => { c.ef++; return O.ge(...a); }; gmsnTocar = (...a) => { c.son++; return O.st(...a); }; humAccion = (...a) => { if (a[1] === 'tiro') c.gesto++; return O.ha(...a); };
        JUG.pitch = 0.45; await esperaJuego(0.3);   // (apuntando al piso a unos 3,5 m: lo que pone bloques o golpea de cerca tiene dónde)
        const w = GMA.swep, c0 = w ? w.clip1 : null, n0 = GMA.ents.size; for (const B of GMSN.bucles.values()) if (B.p) B.p.vol0 = +B.p.vol || 0; ENT.disparo = true; const t1 = TIEMPO.t, r0 = performance.now();
        while (TIEMPO.t < t1 + 1.2 && performance.now() - r0 < 20000) { await new Promise((ok) => setTimeout(ok, 50)); c.part = Math.max(c.part, (GR.parts ? GR.parts.length : 0) + (PART.l ? PART.l.length : 0)); c.ents = Math.max(c.ents, GMA.ents.size - n0);
          for (const B of GMSN.bucles.values()) if (B.p && +B.p.vol > 0.05 && !(c.bucles || (c.bucles = new Set())).has(B.p)) { c.bucles.add(B.p); if (B.p.vol0 === undefined || B.p.vol0 <= 0.05) c.son++; } }
        c.bucles = undefined;
        ENT.disparo = false; await esperaJuego(0.3); gmaBalas = O.fb; sonar = O.so; gmaEfecto = O.ge; gmsnTocar = O.st; humAccion = O.ha; JUG.pitch = 0.12; return { ...c, c0, c1: w ? w.clip1 : null }; })()`);
      r.disparo = dsp;
      await p.screenshot({ path: `${OUT}/${L.id}_${w}_disparo.jpg`, type: 'jpeg', quality: 70 });
      // mira (si tiene)
      r.mira = await ev(`(async () => { const w = GMA.swep; if (!w) return null; const T = claseTabla(w.clase, 'S'); const tiene = !!T && ['IronSightsPos', 'SightsPos', 'IronSightPos', 'Sights', 'IronSightsAng', 'ADSPos', 'AimPos', 'Attachments'].some((k) => { const v = buscarEnClase(T, k); return v !== undefined && v !== null && v !== false; }) || /iron|sight|ads/i.test(String(buscarEnClase(T, 'Base') || ''));
        const vista = () => { const w0 = GMA.swep, v = w0 && w0.vmPropioT && TIEMPO.t - w0.vmPropioT < 0.5 ? w0.vmPropio : ARM.v;   /* (la vista que dibuja el Lua: FA:S, CW 2.0) */ const m = v && v.md && v.md.raiz; const P = m ? [m[12] - CAM.pos.x, m[13] - CAM.pos.y, m[14] - CAM.pos.z] : null; const q = CAM.q.clone().conj ? CAM.q.clone().conj() : null; const l = P && q ? q.rot(v3(...P)) : P ? v3(...P) : null; return { p: l ? [l.x, l.y, l.z] : null, fov: CAM.fov, gm: typeof GMV !== 'undefined' && GMV.ult ? GMV.ult : null }; };
        /* (lo que hace el secundario: el Minecraft SWEP pone bloques con el secundario y con el primario los saca) */
        const n0 = GMA.ents.size, O = window.__orig, c2 = { son: 0, ef: 0 }; sonar = (...a) => { c2.son++; return O.so(...a); }; gmsnTocar = (...a) => { c2.son++; return O.st(...a); }; gmaEfecto = (...a) => { c2.ef++; return O.ge(...a); };
        JUG.pitch = 0.45; await esperaJuego(0.3); const v0 = vista(); ENT.disparo2 = true; await esperaJuego(1.2); const v1 = vista(); ENT.disparo2 = false; await esperaJuego(0.8); JUG.pitch = 0.12;
        /* (las de mira que se prende y se apaga con un toque —FA:S—: otro toque para salir, como en GMod; apuntando no recargan) */
        const v2 = vista(); let toque = false; if (v0.p && v2.p && Math.hypot(v2.p[0] - v0.p[0], v2.p[1] - v0.p[1], v2.p[2] - v0.p[2]) > 0.015) { toque = true; ENT.disparo2 = true; await esperaJuego(0.15); ENT.disparo2 = false; await esperaJuego(0.8); }
        sonar = O.so; gmsnTocar = O.st; gmaEfecto = O.ge; const ents2 = Math.max(0, GMA.ents.size - n0);
        const dm = v0.p && v1.p ? Math.hypot(v1.p[0] - v0.p[0], v1.p[1] - v0.p[1], v1.p[2] - v0.p[2]) : 0;
        return { tiene, dm: +dm.toFixed(3), fov0: +v0.fov.toFixed(1), fov1: +v1.fov.toFixed(1), apunta: dm >= 0.015 || v1.fov < v0.fov - 2, ents2, son2: c2.son, ef2: c2.ef, toque }; })()`);
      // recarga (si tiene cargador)
      r.recarga = await ev(`(async () => { const w = GMA.swep; if (!w) return null; const max = gmaSwepPrim(w, 'ClipSize'), mun = String(gmaSwepPrim(w, 'Ammo') ?? '').toLowerCase(); if (!(max > 1) || mun === 'none' || mun === '') return { tiene: false };   /* (sin munición —Ammo "none", como el Vape— no hay recarga, como en GMod) */
        for (let i = 0; i < 40 && TIEMPO.t < (w.nextP || 0); i++) await esperaJuego(0.2);
        w.clip1 = 1; recargar(); await esperaJuego(0.2); const en = !!w.recarga; let t = 0; while (t < 8 && !(w.clip1 >= max)) { await esperaJuego(0.25); t += 0.25; if (t === 1 && !w.recarga && !(w.clip1 >= max)) { recargar(); } }
        return { tiene: true, max, c1: w.clip1, en, ok: w.clip1 >= max && w.clip1 <= max + 1, s: t }; })()`);
      // 3ª persona (la cámara atrás y arriba): con el arma en la mano y sin dibujarla (misma pose)
      await ev(`(async () => { JUG.yaw = 0; JUG.pitch = 0; clibElegir('R'); CLIB.yaw = 2.5; CLIB.pitch = 0.12; CLIB.dist = 2.4; await esperaJuego(1.2); return 1; })()`);
      const a3 = await foto(); fs.writeFileSync(`${OUT}/${L.id}_${w}_3p.png`, Buffer.from(a3, 'base64'));
      await ev(`(async () => { window.__am = gmhArmaMundo; gmhArmaMundo = () => false; await esperaJuego(0.7); return 1; })()`);
      const b3 = await foto(); await ev(`(() => { gmhArmaMundo = window.__am; return 1; })()`);
      r.vista3 = await dif(a3, b3, [0.15, 0.1, 0.85, 1]);
      await ev(`(async () => { if (CLIB.modo) clibElegir(null); JUG.tercera = false; await esperaJuego(0.3); return 1; })()`);
      r.errores = await ev(`GMA.errores.slice(window.__e0).map((x) => String(x.msg || x).slice(0, 200)).slice(0, 5)`);
      // ¿anda?
      // (las de fuego —por su familia o porque traen cargador y munición de bala— tienen que tirar balas o un proyectil)
      const fuego = r.disparo.balas > 0 || /m9k|fas2|tfa|arccw|cw_|bo2|cso|csgo|awp|ak47|rifle|pistol/i.test(w);
      const motivos = [];
      if (r.vista1.pct < 0.4) motivos.push('no se ve en 1ª');
      else if (r.vista1.vio >= 3) motivos.push(`1ª: ${r.vista1.vio}% damero de textura que falta`);
      if (r.vista3.pct < 0.02) motivos.push('no se ve en 3ª');
      const segundo = r.mira && (r.mira.ents2 > 0);   // (lo suyo va en el secundario: pone bloques)
      if (!(r.disparo.balas || r.disparo.ef || r.disparo.part || r.disparo.ents || r.disparo.son || segundo)) motivos.push('el disparo no hace nada');
      else if (fuego && !(r.disparo.balas || r.disparo.ents) && !/grenade|frag|nade|knife|melee|damascus|machete|sword|katana|fists|c4/i.test(w)) motivos.push('no sale ninguna bala');
      else if (fuego && !r.disparo.son) motivos.push('dispara sin sonido');
      if (r.mira && r.mira.tiene && !r.mira.apunta) motivos.push('no apunta');
      if (r.recarga && r.recarga.tiene && !r.recarga.ok) motivos.push('no recarga');
      if (r.errores.length) motivos.push('errores de Lua: ' + r.errores[0].slice(0, 90));
      r.anda = !motivos.length; r.motivo = motivos.join('; ');
      res.push(r); fs.writeFileSync(SAL, JSON.stringify(res, null, 1));
      console.log((r.anda ? 'ANDA ' : 'FALLA') + ' ' + L.id + ' ' + w + ' · 1ª ' + r.vista1.pct + '% · 3ª ' + r.vista3.pct + '% · balas ' + r.disparo.balas + ' son ' + r.disparo.son + ' ef ' + r.disparo.ef + (r.mira && r.mira.tiene ? ' · mira ' + r.mira.apunta : '') + (r.recarga && r.recarga.tiene ? ' · recarga ' + r.recarga.ok : '') + (r.motivo ? ' · ' + r.motivo : ''));
    }
  } catch (e) {
    res.push({ addon: L.id, arma: null, anda: false, motivo: 'la prueba se cortó: ' + String(e.message || e).slice(0, 150) }); fs.writeFileSync(SAL, JSON.stringify(res, null, 1));
    console.log('ADDON', L.id, 'SE CORTÓ', String(e.message || e).slice(0, 150)); await nueva();
  }
}
const A = res.filter((r) => r.arma), ok = A.filter((r) => r.anda);
console.log(`RESUMEN armas que andan ${ok.length}/${A.length} (addons sin armas: ${res.filter((r) => !r.arma).length})`);
await s.b.close(); process.exit(0);
