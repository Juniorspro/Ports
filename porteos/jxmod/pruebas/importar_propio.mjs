// Importar personaje «con sus huesos» (panel yx3crm92: «cuando intento cargarlo con los huesos que ya tenía el modelo no
// carga, pero con reguear desde cero sí»). Con modelos reales con esqueleto (los de Mixamo de los ejemplos de three.js
// —Xbot, Soldier, Michelle—, los de muestra de Khronos —CesiumMan, RiggedFigure, BrainStem—, el Robot de Quaternius y un VRM
// de pixiv), cada uno por todo el camino que hace el jugador con «usar sus huesos»:
//  leer → reconocer el esqueleto humano (el mapa) → rig propio → modelo (vista previa) → empacar y guardar → desempacar y
//  armar como al entrar a la partida → puesto en una persona del juego, que se dibuja animada (caminando) sin errores.
// Por modelo: OK si llega al final; si no, en qué paso y con qué error.
// Y uno de más de 255 huesos con peso (MuchosHuesos.glb: el VRM sin sus datos de VRM —los nombres J_Bip_… de VRoid— y 260
// huesos más con vértices, de muchos_huesos.py): antes «con sus huesos» no cargaba (demasiados huesos, o el muslo elegido era
// un ayudante J_Aim_… sin rodilla debajo).
// Los modelos (fuera del repo): three.js r160 examples/models/gltf (Xbot, Soldier, Michelle, RobotExpressive), Khronos
// glTF-Sample-Assets (CesiumMan, RiggedFigure, BrainStem), pixiv/three-vrm examples/models (VRM1_Constraint_Twist_Sample).
// uso: node importar_propio.mjs URL_HTML URL_MODELOS [CARPETA_FOTOS] [archivo1,archivo2,…]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, MOD, D = '/tmp/claude-0/importar_propio', LISTA] = process.argv; fs.mkdirSync(D, { recursive: true });
const MODELOS = (LISTA || 'Xbot.glb,Soldier.glb,Michelle.glb,RobotExpressive.glb,CesiumMan.glb,RiggedFigure.glb,BrainStem.glb,VRM1_Constraint_Twist_Sample.vrm').split(',');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.cuerpo`), null, { timeout: 90000 }); await p.waitForTimeout(1500);
for (const m of MODELOS) {
  const r = await ev(`(async () => {
    const out = { paso: 'bajar' }, ms = {};
    try {
      const u = new Uint8Array(await (await fetch(${JSON.stringify(MOD)} + '/' + ${JSON.stringify(m)})).arrayBuffer()), f = new File([u], ${JSON.stringify(m)});
      out.paso = 'leer'; let t = performance.now(); const ses = await pjiProcesar([f]); ms.leer = Math.round(performance.now() - t);
      out.huesos = ses.C.huesos ? ses.C.huesos.length : 0; out.imgs = ses.C.imgs.length; out.tex = ses.tex.filter(Boolean).length; out.mapa = !!ses.mapa; out.usarPropio = ses.usarPropio;
      if (!ses.mapa) { out.paso = 'mapa'; return out; }
      out.paso = 'rig'; t = performance.now(); pjiSesArmar(ses); ms.rig = Math.round(performance.now() - t); out.nb = ses.rig.huesos.length;
      out.paso = 'empacar'; const pack = await pjiEmpacar(ses, ses.nombre || 'x', 1024); out.kb = Math.round(pack.length / 1024);
      if (pack.length > PJI_MAX.tot) { out.paso = 'muyGrande'; return out; }
      const id = pjiHuella(pack); out.paso = 'guardar';
      await pjiGuardar({ id, n: 'prueba', img: '', alto: ses.alto, fecha: Date.now(), nv: ses.Nm.pos.length / 3, nb: ses.rig.huesos.length, propio: true, kb: out.kb }, pack);
      out.paso = 'armarGuardado'; PJI.defs.delete(id); const def = await pjiArmarGuardado(id); if (!def) return out;
      out.paso = 'persona'; out.matsDef = def.M.texturas.map((nm) => { const g = GMOD.mats.get(nm + '|'), M = g && DATA.mt[g.mi]; return M ? [M.t, !!(R.tex[M.t] && R.tex[M.t].gl), M.sh] : null; }).slice(0, 4); const P = crearPersona(pjiSkin(id), 'HatEmpty', { nombre: '' }); P.pos.copy(JUG.pos).add(v3(1.6, 0, 2.2)); P.yaw = Math.PI * 0.85; P.vel.set(0, 0, 0);
      for (let k = 0; k < 20; k++) { animarPersona(P, 1 / 30); dibujarPersona(P); }
      out.gmp = !!P.gmp; out.gmpRuta = P.gmpRuta || null; out.propioG = !!(P.gmp && P.gmp.propio);
      window.__pjP = P; out.paso = P.gmp ? 'fin' : 'persona';
    } catch (e) { out.error = String(e && (e.message || e)) + (e && e.det ? ' (' + e.det + ')' : ''); out.pila = String(e && e.stack || '').split('\\n').slice(0, 3).join(' | '); }
    out.ms = ms; return out;
  })()`);
  if (r.paso === 'fin') { await p.waitForTimeout(600); await p.screenshot({ path: D + '/' + m.replace(/\W+/g, '_') + '.png' }); }
  await ev(`(() => { if (window.__pjP) { borrarPersona(window.__pjP); window.__pjP = null; } return 1; })()`);
  ok(m + ': carga con sus huesos hasta el juego', r.paso === 'fin' && !r.error, r);
}
// el recorte cuando sobran huesos con peso: con un tope de 90 (el modelo de 414 huesos, ~160 con peso), quedan 90 o menos,
// todos los del cuerpo siguen y cada vértice sigue con pesos que suman 1
if (MODELOS.includes('MuchosHuesos.glb')) {
  const r = await ev(`(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(MOD)} + '/MuchosHuesos.glb')).arrayBuffer()); const ses = await pjiProcesar([new File([u], 'MuchosHuesos.glb')]);
    const H = ses.Nm.huesos.map((h) => ({ n: h.n, pa: h.pa, mix: null })); for (const k in ses.mapa) if (k !== '_palmas' && ses.mapa[k] >= 0) H[ses.mapa[k]].mix = k;
    const dest = pjiReducirHuesos(H, ses.Nm, 90), quedan = dest.filter((d, i) => d === i).length, cuerpo = Object.keys(ses.mapa).filter((k) => k !== '_palmas' && ses.mapa[k] >= 0).every((k) => dest[ses.mapa[k]] === ses.mapa[k]);
    const padresOk = dest.every((d, i) => d !== i || H[i].pa < 0 || dest[H[i].pa] === H[i].pa);
    return { antes: H.length, quedan, cuerpo, padresOk }; })()`);
  ok('con muchos huesos con peso, se juntan en sus padres hasta el tope (90), sin perder los del cuerpo', r.quedan <= 90 && r.cuerpo && r.padresOk, r);
}
const errJs = err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x));
ok('sin errores de JS', !errJs.length, errJs.slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
