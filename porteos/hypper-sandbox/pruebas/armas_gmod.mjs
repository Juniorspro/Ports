// la Tool Gun y la Physics Gun de GMod y la Gravity Gun de HL2: las vistas (sacar, quieto, disparo), agarrar una caja con
// la física (la vista "sujeta" mientras la tiene y vuelve a quieto al soltar), con la de gravedad levantarla y lanzarla,
// los sonidos de cada cosa, los íconos y fotos en primera persona
// uso: node armas_gmod.mjs HTML CARPETA [mapa]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', MAPA = process.argv[4] || 'RB_Flatgrass';
const { b, p, err, ev } = await abrir(HTML);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); DIA.hora = 13; DIA.aplicada = -1; 1`);
await p.waitForTimeout(4000);
const juego = async (s) => { const t0 = await ev(`TIEMPO.t`); for (let i = 0; i < 400 && (await ev(`TIEMPO.t`)) < t0 + s; i++) await p.waitForTimeout(60); };
const foto = (n) => p.screenshot({ path: D + 'gm_' + n + '.jpg', type: 'jpeg', quality: 85 });
const clipAhora = `Object.entries(DATA.anPorNombre).find(([k, v]) => v === (ARM.v && ARM.v.clip))?.[0] || null`;
await ev(`window.__son = []; const _s = sonar; sonar = (n, ...r) => { window.__son.push(n); return _s(n, ...r); }; const _b = bucle; window.__bucles = new Set(); bucle = (k, n, ...r) => { window.__bucles.add(n); return _b(k, n, ...r); }; 1`);
const datos = await ev(`(() => { const o = {};
  for (const a of ['ToolBaton', 'PhysicsGun', 'GravityGun']) { const D = DEF_ARMAS[a];
    o[a] = { vista: !!vistaArma(D.nodo), boca: (vistaArma(D.nodo) || {}).mz >= 0, clips: [D.sacar, D.quieto, D.fuego, D.sujeta].filter(Boolean).map((c) => !!DATA.anPorNombre[c]),
      sonidos: [].concat(D.sF || [], D.sAgarra || [], D.sSuelta || [], D.sVacio || [], D.sSosten || []).map((n) => !!PK.parte('a:' + n)), icono: !!DATA.ico[D.ic], mano: !!(DATA.gm.armas[a]) }; }
  return o; })()`);
console.log(JSON.stringify(datos));
for (const [a, x] of Object.entries(datos)) ok(`${a}: vista con boca, clips, sonidos, ícono y modelo en la mano`, x.vista && x.boca && x.clips.every(Boolean) && x.sonidos.every(Boolean) && x.icono && x.mano, x);
// delante: una caja a 3 m, mirando un poco abajo
await ev(`$('hud').classList.add('oc'); JUG.noclip = false; JUG.vel.set(0, 0, 0); JUG.pitch = 0.08; 1`);
const caja = async () => ev(`(() => { if (window.__caja) borrarObjeto(window.__caja); const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const ob = crearObjeto('Box2', vadd(JUG.pos, v3(f.x * 3, -0.4, f.z * 3)), Quat.euler(JUG.yaw, 0)); window.__caja = ob; return !!ob; })()`);
const mirarCaja = async () => { await ev(`(() => { const c = window.__caja.b.pos, d = vsub(c, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); return 1; })()`); await juego(0.3); };
// 1) Tool Gun
await ev(`elegirArma(ARM.lista.indexOf('ToolBaton')); 1`); await juego(0.15); await foto('tool_sacar'); await juego(1.2);
const tq = await ev(clipAhora); await foto('tool_quieto');
const tc = await ev(`(() => { window.__son = []; ARM.t = 0; ARM.ocup = 0; disparar(); return ${clipAhora}; })()`); await juego(0.04); await foto('tool_disparo');   // (dura poco: se mira al disparar)
const ts = await ev(`window.__son.slice()`); await juego(1.2); const tq2 = await ev(clipAhora);
ok('Tool Gun: sacar → quieto, disparo con su animación y su sonido, vuelve a quieto', tq === 'TG_idle' && tc === 'TG_fire' && ts.some((n) => /^TG_Fire/.test(n)) && tq2 === 'TG_idle', { tq, tc, ts, tq2 });
// 2) Physics Gun: agarrar la caja, sostener, soltar
await caja(); await juego(1.0);
await ev(`elegirArma(ARM.lista.indexOf('PhysicsGun')); 1`); await juego(1.2); await mirarCaja(); const pq = await ev(clipAhora); await foto('fisica_quieta');
await ev(`window.__son = []; window.__bucles = new Set(); ENT.disparo = true; 1`); await juego(0.6);
const pa = await ev(`({ agarra: !!ARM.agarre, clip: ${clipAhora}, bucles: [...window.__bucles] })`); await foto('fisica_sosteniendo');
await ev(`ENT.disparo = false; 1`); await juego(0.4);
const ps = await ev(`({ agarra: !!ARM.agarre, clip: ${clipAhora}, son: window.__son.slice() })`);
ok('Physics Gun: agarra la caja, la vista "sujeta" con su zumbido, al soltar vuelve a quieto con su sonido', pq === 'PG_idle' && pa.agarra && pa.clip === 'PG_hold' && pa.bucles.includes('PG_Hold') && !ps.agarra && ps.clip === 'PG_idle' && ps.son.includes('PG_Off'), { pq, pa, ps });
// 3) Gravity Gun: levantar (clic derecho), lanzar (clic)
await ev(`if (!ARM.lista.includes('GravityGun')) ARM.lista.push('GravityGun'); elegirArma(ARM.lista.indexOf('GravityGun')); 1`); await juego(1.2); await caja(); await juego(1.0); await mirarCaja();
const gq = await ev(clipAhora); await foto('grav_quieta');
await ev(`window.__son = []; ENT.disparo2 = true; 1`); await juego(0.6);
const ga = await ev(`({ tiene: !!ARM.grav, clip: ${clipAhora}, son: window.__son.slice() })`); await foto('grav_sosteniendo');
const v0 = await ev(`[window.__caja.b.pos.x, window.__caja.b.pos.z]`);
await ev(`window.__son = []; ARM.t = 0; ARM.ocup = 0; disparar(); 1`); await juego(0.1); await foto('grav_lanza');
const gl = await ev(`({ tiene: !!ARM.grav, clip: ${clipAhora}, son: window.__son.slice(), vel: +Math.hypot(window.__caja.b.vel.x, window.__caja.b.vel.z).toFixed(1) })`);
await juego(1.0); const v1 = await ev(`[window.__caja.b.pos.x, window.__caja.b.pos.z]`), gq2 = await ev(clipAhora);
ok('Gravity Gun: levanta (sujeta y su sonido), lanza (disparo, su sonido, la caja sale) y vuelve a quieto', gq === 'GG_idle' && ga.tiene && ga.clip === 'GG_hold' && ga.son.includes('GG_Pickup') && !gl.tiene && gl.clip === 'GG_fire' && gl.son.some((n) => /^GG_Launch/.test(n)) && Math.hypot(v1[0] - v0[0], v1[1] - v0[1]) > 2 && gq2 === 'GG_idle', { gq, ga, gl, movida: +Math.hypot(v1[0] - v0[0], v1[1] - v0[1]).toFixed(1), gq2 });
await ev(`window.__son = []; window.__caja.b.pos.set(0, -999, 0); ARM.t = 0; ARM.ocup = 0; JUG.pitch = -1.2; 1`); await juego(0.3); await ev(`disparar(); 1`); await juego(0.2);
ok('Gravity Gun: sin nada adelante suena en seco', (await ev(`window.__son.slice()`)).includes('GG_Dry'));
ok('sin errores', !err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).length, err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
