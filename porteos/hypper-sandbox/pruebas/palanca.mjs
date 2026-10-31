// la palanca (crowbar): en primera persona (sacar, quieto, golpe al aire y golpe que pega, cuadro a cuadro), en tercera
// persona, suelta como prop y en el menú de armas; que pegue (empuja una caja), que suenen sus sonidos y que no haya errores
// uso: node palanca.mjs HTML CARPETA [mapa]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', MAPA = process.argv[4] || 'RB_Construct';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); 1`);
await p.waitForTimeout(5000);
const juego = async (s) => { const t0 = await ev(`TIEMPO.t`); for (let i = 0; i < 400 && (await ev(`TIEMPO.t`)) < t0 + s; i++) await p.waitForTimeout(60); };
const foto = (n) => p.screenshot({ path: D + 'cb_' + n + '.jpg', type: 'jpeg', quality: 85 });
const r0 = await ev(`({ lista: ARM.lista.slice(), sel: ARM.lista[ARM.i], vista: !!vistaArma('Crowbar'), clips: ['CB_idle','CB_draw','CB_hit1','CB_miss1'].map((c) => !!DATA.anPorNombre[c]),
  sonidos: ['CB_Swing','CB_Impact1','CB_Flesh1'].map((n) => !!PK.parte('a:' + n)), icono: !!DATA.ico.W_Crowbar, prop: !!DATA.pfPorNombre.Crowbar, menu: DATA.menu.find((c) => c.n === 'Weapons').sub[0].it.includes('Crowbar') })`);
console.log(JSON.stringify(r0));
// mirar una pared lisa a 1,2 m para ver el arma sola: la aparición mirando a un lado
await ev(`$('hud').classList.add('oc'); JUG.noclip = true; const sp = MUNDO.spawns[0]; JUG.pos.set(sp.x, sp.y + 1, sp.z); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI; JUG.pitch = 0.05; DIA.hora = 12; DIA.aplicada = -1; elegirArma(ARM.lista.indexOf('Crowbar')); 1`);
// sacar: cuadros a los 0.1, 0.4 s y quieto
await juego(0.1); await foto('sacar1'); await juego(0.3); await foto('sacar2'); await juego(1.2); await foto('quieto');
const q = await ev(`({ clip: ARM.v.clip === DATA.anPorNombre.CB_idle, loop: ARM.v.loop })`); console.log('después de sacar: quieto en bucle', JSON.stringify(q));
// golpe al aire (mirando al cielo)
await ev(`JUG.pitch = -1.2; ENT.disparo = true; 1`); await juego(0.08); await ev(`ENT.disparo = false; 1`); await foto('aire1'); await juego(0.15); await foto('aire2'); await juego(0.6);
// una caja delante: golpe que pega (la caja se mueve)
const caja = await ev(`(() => { const f = CAM.fwd, o = vadd(JUG.pos, v3(Math.sin(JUG.yaw) * 1.3, 0, Math.cos(JUG.yaw) * 1.3)); const ob = crearObjeto('Box2', v3(o.x, JUG.pos.y - 0.2, o.z), Quat.euler(JUG.yaw, 0)); window.__caja = ob; return !!ob; })()`);
await ev(`(() => { const c = window.__caja.b.pos, dx = c.x - CAM.pos.x, dz = c.z - CAM.pos.z; JUG.pitch = Math.atan2(CAM.pos.y - c.y, Math.hypot(dx, dz)); return 1; })()`); await juego(0.6);
const antes = await ev(`window.__caja ? [window.__caja.b.pos.x, window.__caja.b.pos.z] : null`);
console.log('caja antes:', JSON.stringify(await ev(`(() => { const b = window.__caja.b; return { din: !!b.dynamic, quieta: !!b.frozen, masa: b.mass, duerme: !!b.sleeping }; })()`)));
const vh = await ev(`(() => { const h = raycast(CAM.pos, CAM.fwd, 1.95, null); return h ? (h.body && h.body.obj === window.__caja ? 'caja' : 'otra cosa') : 'nada'; })()`);
await ev(`window.__son = []; const _s = sonar; sonar = (n, ...r) => { window.__son.push(n); return _s(n, ...r); }; ARM.t = 0; ARM.ocup = 0; disparar(); 1`); console.log('disparo:', JSON.stringify(await ev(`[ARM.t, ARM.lista[ARM.i], window.__son.slice(), !!ARM.golpeD]`))); await juego(0.06); await foto('pega1');
await juego(0.1); console.log('sonidos del golpe:', JSON.stringify(await ev(`window.__son`)), 'vel caja', JSON.stringify(await ev(`[window.__caja.b.vel.x, window.__caja.b.vel.y, window.__caja.b.vel.z].map((v) => +v.toFixed(2))`))); await juego(0.12); await foto('pega2'); await juego(1.0);
const despues = await ev(`window.__caja ? [window.__caja.b.pos.x, window.__caja.b.pos.z] : null`);
const clipPega = await ev(`Object.entries(DATA.anPorNombre).find(([k, v]) => v === ARM.v.clip)?.[0]`);
console.log('caja', caja, '· la mira apunta a', vh, '· se movió', antes && despues ? +Math.hypot(despues[0] - antes[0], despues[1] - antes[1]).toFixed(2) : null, 'm · clip ahora', clipPega);
// tercera persona
await ev(`JUG.tercera = true; JUG.noclip = false; JUG.pitch = 0.2; 1`); await juego(1.2); await foto('tercera');
// (de cerca, de costado: la palanca en la mano)
await ev(`JUG.yaw += 2.3; 1`); await juego(0.8); await foto('tercera2');
await ev(`JUG.tercera = false; 1`);
// suelta como prop
await ev(`spawnDelante('Crowbar', {}); 1`); await juego(1.5); await foto('prop');
const pr = await ev(`(() => { const o = OBJS[OBJS.length - 1]; return o ? { nombre: o.nombre, tipo: o.tipo, y: +o.b.pos.y.toFixed(2) } : null; })()`); console.log('prop', JSON.stringify(pr));
// el menú de armas con su ícono
await ev(`$('hud').classList.remove('oc'); 1`); await ev(`(() => { const i = DATA.menu.findIndex((c) => c.n === 'Weapons'); UI.tab = i; UI.sub = 0; UI.q = ''; abrirSpawn(); return 1; })()`); await p.waitForTimeout(800); await foto('menu');
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
