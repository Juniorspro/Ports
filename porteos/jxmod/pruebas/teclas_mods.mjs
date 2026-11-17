// los botones de las teclas de las armas de los mods, en el celular (3.9.1: «hay muchos botones que no andan»): para cada
// addon de armas, se pone su arma en la mano y se miran los botones que salen (bmod0–3, controles.js): cuáles se ven, que
// los que se ven sean los que el mod escucha (gmbVivo) y que, al tocarlos, lo apretado le llegue al Lua del mod (la tecla
// la pregunta mientras está apretada, el IN_ lo mira, el bind lo toma un PlayerBindPress) sin errores de Lua nuevos.
// Además: la antorcha de Minecraft se clava en el piso con el secundario (su primario sólo actúa sobre algo que tenga adelante).
// uso: node pruebas/teclas_mods.mjs URL_HTML URL_GMA [ids,separados,por,coma]   (URL_GMA: carpeta con <id>/<id>.gma)
import { abrir } from './base.mjs';
const [, , HTML, GMA, LISTA] = process.argv;
const IDS = (LISTA || '3786646774,3776498100,554915029,3813187720,2106330193,111412589,291904779,3788311975,150727261,3823242205,283172200,3782675865,297646940,104607519,3821585692,531906218,3781016427,278185787,3808166353').split(',');
const { b, p, ev } = await abrir(HTML, false);
await p.setViewportSize({ width: 873, height: 393 });
const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); ENT.tactil = true; document.body.classList.add('tactil'); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await ev(`(() => { cerrarPaneles(); window.__esperar = (s) => new Promise((ok) => { const t0 = TIEMPO.t, f = () => (TIEMPO.t - t0 >= s ? ok() : setTimeout(f, 50)); f(); });
  /* (el bind que tomó un PlayerBindPress: se anota) */ const g0 = gmaBind; gmaBind = function (x) { const r = g0.apply(this, arguments); (window.__binds = window.__binds || []).push([x, !!r]); return r; }; return 1; })()`);
const res = []; let mal = 0;
for (const id of IDS) {
  const r = await ev(`(async () => {
    for (const k of [...GMOD.addons.keys()]) gmQuitar(k); JUG.pos.set(0, JUG.pos.y, 0); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.1;
    const b = new Uint8Array(await (await fetch(${JSON.stringify(GMA)} + '/${id}/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b); await A.listo; await __esperar(0.3);
    const w = (A.sweps || [])[0]; if (!w) return { id: '${id}', sinArma: true };
    gmaSpawnMenu('gmswep:' + w); await __esperar(2.5);
    const e0 = GMA.errores.length, bots = [];
    for (let i = 0; i < 4; i++) { const e = document.getElementById('bmod' + i), c = e && e._ctl; if (!c) continue;
      const k = c.bind ? 'bind:' + c.bind : /^IN_/.test(c.id) ? 'in:' + c.id.slice(3) : c.tecla ? 'key:' + c.tecla : null, ve = !e.classList.contains('oc');
      const o = { t: String(c.t).slice(0, 10), k: k || ('raton:' + c.raton), ve, vivo: c.raton ? !!(GMA.teclasVis && GMA.teclasVis.has(c.raton)) || gmbHook('PlayerButtonDown') || gmbHook('PlayerButtonUp') : !k || gmbVivo(k) };
      if (ve) {   // (tocarlo: lo que tiene que llegar le llega al Lua mientras está apretado)
        GMA.teclasVis = new Set(); GMA.inVis = 0; window.__binds = [];
        e.dispatchEvent(new MouseEvent('mousedown')); await __esperar(0.5); const nn = c.tecla ? GMA_JSKEY.get(c.tecla) : c.raton, bit = /^IN_/.test(c.id) ? (GMB_IN[c.id.slice(3)] || 0) : 0;
        const dentro = { teclas: [...GMA.teclasVis], inVis: GMA.inVis, entrega: c.bind ? window.__binds.some(([x]) => x === c.bind) : bit ? !!(gmaTeclas() & bit) : !!nn && gmaBotones().has(nn) };
        e.dispatchEvent(new MouseEvent('mouseup')); await __esperar(0.3);
        const n = c.tecla && GMA_JSKEY.get(c.tecla);
        // (entrega: el juego se lo da al Lua si lo pregunta; usa: el Lua lo preguntó —o el bind lo tomó— mientras estaba apretado)
        o.entrega = dentro.entrega; o.llega = c.bind ? window.__binds.some(([x, t]) => x === c.bind && t) : bit ? !!(dentro.inVis & bit) : !!nn && dentro.teclas.includes(nn);
      }
      bots.push(o); }
    return { id: '${id}', nombre: A.G.nombre || '', arma: w, enMano: ARM.lista[ARM.i], bots, luaNuevos: GMA.errores.slice(e0).map((x) => String(x.msg || x).slice(0, 120)) };
  })()`).catch((x) => ({ id, error: String(x.message || x).slice(0, 160) }));
  const bien = !r.error && (r.sinArma || ((r.bots || []).every((x) => x.ve === x.vivo && (!x.ve || x.entrega)) && !(r.luaNuevos || []).length));   // (lo que no entrega es un botón roto; lo que entrega y el mod no usa en ese momento, depende del mod)
  if (!bien) mal++;
  res.push(r);
  console.log((bien ? 'OK   ' : 'FALLA'), id, (r.nombre || '').slice(0, 34).padEnd(34), r.arma || '', JSON.stringify((r.bots || []).map((x) => [x.t, x.ve ? (x.llega ? 'anda' : x.entrega ? 'entrega (el mod no lo leyó en ese momento)' : 'NO LLEGA') : x.vivo ? 'OCULTO(vivo)' : 'oculto (no lo escucha)'])), r.luaNuevos && r.luaNuevos.length ? 'lua: ' + JSON.stringify(r.luaNuevos.slice(0, 2)) : '', r.error || '');
}
// la antorcha de Minecraft: el secundario la clava en el piso adelante
if (IDS.includes('104607519')) {
  const t = await ev(`(async () => { for (const k of [...GMOD.addons.keys()]) gmQuitar(k); const b = new Uint8Array(await (await fetch(${JSON.stringify(GMA)} + '/104607519/104607519.gma')).arrayBuffer()); const A = await gmInstalar('104607519', { nombre: 'torch', sinDeps: true }, b); await A.listo;
    gmaSpawnMenu('gmswep:weapon_minecraft_torch'); await __esperar(2); JUG.pitch = 1.2; await __esperar(0.3);
    const n0 = [...GMA.ents.values()].filter((e) => /minecraft_torch/.test(e.clase || e.cls || '')).length; ENT.disparo2 = true; await __esperar(0.3); ENT.disparo2 = false; await __esperar(0.6);
    const n1 = [...GMA.ents.values()].filter((e) => /minecraft_torch/.test(e.clase || e.cls || '')).length; JUG.pitch = 0.1; return { n0, n1 }; })()`).catch((x) => ({ error: String(x.message || x).slice(0, 160) }));
  const bien = !t.error && t.n1 > t.n0; if (!bien) mal++;
  console.log((bien ? 'OK   ' : 'FALLA'), 'la antorcha de Minecraft se clava en el piso con el secundario', JSON.stringify(t));
}
console.log(err.length ? 'errores de JS ' + JSON.stringify(err.slice(0, 3)) : 'sin errores de JS');
const conBot = res.filter((r) => (r.bots || []).some((x) => x.ve)).length, nb = res.reduce((a, r) => a + (r.bots || []).filter((x) => x.ve).length, 0), oc = res.reduce((a, r) => a + (r.bots || []).filter((x) => !x.ve).length, 0);
console.log(`botones que se ven: ${nb} (en ${conBot} armas) · ocultos porque el mod no los escucha: ${oc}`);
console.log(mal || err.length ? 'HAY FALLAS' : 'TODO BIEN', (IDS.length + (IDS.includes('104607519') ? 1 : 0) - mal) + '/' + (IDS.length + (IDS.includes('104607519') ? 1 : 0)));
await b.close();
