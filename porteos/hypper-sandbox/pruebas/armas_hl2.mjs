// las armas de Half-Life 2 en lugar de las del juego (pistola, .357, SMG, AR2, escopeta, ballesta, RPG, francotirador):
// cada una con su vista (sacar → quieto en bucle), el disparo con su animación y su sonido, la recarga con la suya (la
// escopeta, después del tiro, la corredera), el ícono y el modelo en la mano en tercera persona; fotos en primera persona
// uso: node armas_hl2.mjs HTML CARPETA
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Flatgrass'); DIA.hora = 13; DIA.aplicada = -1; 1`);
await p.waitForTimeout(4000);
const juego = async (s) => { const t0 = await ev(`TIEMPO.t`); for (let i = 0; i < 400 && (await ev(`TIEMPO.t`)) < t0 + s; i++) await p.waitForTimeout(60); };
const clipAhora = `(Object.entries(DATA.anPorNombre).find(([k, v]) => v === (ARM.v && ARM.v.clip))?.[0] || null)`;
await ev(`$('hud').classList.add('oc'); JUG.noclip = true; JUG.pitch = 0.1; window.__son = []; const _s = sonar; sonar = (n, ...r) => { window.__son.push(n); return _s(n, ...r); }; 1`);
const ARMAS = ['Pistol', 'Revolver', 'Smg', 'Akm', 'Shotgun', 'Crossbow', 'RPG', 'Sniper'];
for (const a of ARMAS) {
  const x = await ev(`(() => { const H = DATA.gm.hl2 && DATA.gm.hl2['${a}'], D = DEF_ARMAS['${a}']; if (!H) return null;
    if (!ARM.lista.includes('${a}')) ARM.lista.push('${a}'); ARM.balas['${a}'] = D.car; elegirArma(ARM.lista.indexOf('${a}'));
    return { nodo: D.nodo, vista: !!ARM.v, sacar: ${clipAhora}, ic: !!DATA.ico[D.ic], mano: !!DATA.gm.armas['${a}'], pose: POSE_ARMA['${a}'] }; })()`);
  if (!x) { ok(`${a}: convertida`, false); continue; }
  await juego(1.5); const quieto = await ev(clipAhora);
  await p.screenshot({ path: D + 'hl2_' + a + '.jpg', type: 'jpeg', quality: 82 });
  const tiro = await ev(`(() => { window.__son = []; ARM.t = 0; ARM.ocup = 0; ENT.disparo = true; armasPaso(0.016); ENT.disparo = false; return { clip: ${clipAhora}, son: window.__son.slice() }; })()`);
  await juego(0.08); await p.screenshot({ path: D + 'hl2_' + a + '_tiro.jpg', type: 'jpeg', quality: 82 });
  let tras = null; if (a === 'Shotgun') { await ev(`(() => { ARM.v.t = ARM.v.clip.d; return 1; })()`); await juego(0.1); tras = await ev(clipAhora); }
  await juego(1.6);
  const rec = await ev(`(() => { window.__son = []; ARM.balas['${a}'] = 0; ARM.recargando = 0; ARM.ocup = 0; recargar(); return { clip: ${clipAhora}, son: window.__son.slice(), dura: +ARM.recargando.toFixed(2) }; })()`);
  await juego(4.3); const fin = await ev(`({ clip: ${clipAhora}, balas: ARM.balas['${a}'] })`);
  const pref = x.nodo.replace('HL_', '');
  const bien = x.vista && x.ic && x.mano && /_draw$/.test(x.sacar || '') && /_idle$/.test(quieto || '') && /_fire$/.test(tiro.clip || '') &&
    (a === 'Sniper' || tiro.son.some((n) => /^H[A-Z0-9]_Fire/.test(n))) && /_reload$/.test(rec.clip || '') && /_idle$/.test(fin.clip || '') && fin.balas > 0 && (a !== 'Shotgun' || tras === 'HG_pump');
  ok(`${a} (${x.nodo}): sacar, quieto, tiro con sonido, recarga y vuelve a quieto${a === 'Shotgun' ? ', corredera' : ''}`, bien, { ...x, quieto, tiro, tras, rec, fin });
}
ok('sin errores', !err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).length, err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
