// modo creador: poner cosas, roles, guardar, probar y elegir rol
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/';
const D = SALIDA;
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.mods = {}; inicioMostrar(true)`);
await p.click('[data-rb=crear]'); await p.waitForTimeout(600); await p.screenshot({ path: D + 'c0_panel.png' });
await p.click('[data-rb="creaBase:FlatGrass"]'); await p.waitForTimeout(300);
await p.click('[data-rb=creaNuevo]'); await p.waitForTimeout(4500);
console.log('creador:', await ev(`JSON.stringify({on: CREA.on, noclip: JUG.noclip, barra: !!$('creaBar'), btns: $('creaBar').textContent.slice(0,120)})`));
await p.screenshot({ path: D + 'c1_creador.png' });
// paleta y poner un piano mirando al piso
await ev(`JUG.pos.set(0, 12, -20); JUG.yaw = 0; JUG.pitch = 0.6`); await p.waitForTimeout(400);
await ev(`creadorAccion('paleta')`); await p.waitForTimeout(400); await p.screenshot({ path: D + 'c2_paleta.png' });
await p.click('[data-cp="tipo:piano"]'); await p.waitForTimeout(500); await p.screenshot({ path: D + 'c3_poniendo.png' });
await ev(`creadorAccion('poner')`); await p.waitForTimeout(500);
// un rol y dos puntos con ese rol, otro rol con un punto
await ev(`creadorAccion('roles')`); await p.waitForTimeout(300);
await p.click('[data-cp=nuevoRol]'); await p.waitForTimeout(300); await p.click('[data-cp=nuevoRol]'); await p.waitForTimeout(300);
await p.fill('.crRol[data-i="0"] input[data-rk=nombre]', 'Policías'); await p.fill('.crRol[data-i="1"] input[data-rk=nombre]', 'Ladrones');
await p.fill('.crRol[data-i="1"] input[data-rk=vida]', '250');
await p.click('[data-cp="arma:1:Pistol"]');
await p.screenshot({ path: D + 'c4_roles.png' });
await p.click('[data-cp="usarRol:0"]'); await p.waitForTimeout(200); await p.click('[data-cp=cerrarRoles]'); await p.waitForTimeout(200);
await ev(`JUG.pos.set(10, 6, 0); JUG.pitch = 1.2; creadorAccion('punto'); JUG.pos.set(14, 6, 0); creadorAccion('punto')`);
await ev(`CREA.rol = CREA.mapa.roles[1].id; JUG.pos.set(-30, 6, 10); creadorAccion('punto')`);
// una rampa chica y un teletransporte
await ev(`CREA.tipo='rampa'; JUG.pos.set(60, 8, -60); JUG.pitch=1.3; creadorAccion('poner')`);
await ev(`const e = CREA.sel.e; const d = entidadDatos(e); d.prm.alto = 30; creadorRehacer(e, d)`);
await ev(`CREA.tipo='teleport'; JUG.pos.set(-10, 6, -10); creadorAccion('poner')`);
await ev(`creadorAccion('mapa')`); await p.waitForTimeout(300); await p.fill('#crNom', 'Prueba policías'); await p.click('[data-cp=datosOk]');
await ev(`JUG.pos.set(20, 40, -80); JUG.yaw = 0.3; JUG.pitch = 0.45`); await p.waitForTimeout(1000); await p.screenshot({ path: D + 'c5_mapa.png' });
const v = JSON.parse(await ev(`const v = creadorGuardar(); JSON.stringify({id: v.id, n: v.nombre, ents: v.entidades.map(e=>e.t), spawns: v.spawns.length, roles: v.roles.map(r=>[r.nombre, r.vida, r.armas]), en: !!INST.mapas[v.id]})`));
console.log('guardado:', JSON.stringify(v));
await p.waitForTimeout(800);
await ev(`creadorAccion('probar')`); await p.waitForTimeout(4500);
console.log('jugando:', await ev(`JSON.stringify({crea: CREA.on, ents: ENTS.lista.map(e=>e.t), rolPan: $('rolPan') && !$('rolPan').classList.contains('oc'), ui: UI.abierto})`));
await p.screenshot({ path: D + 'c6_roles.png' });
await p.click('[data-rol="1"]'); await p.waitForTimeout(1500);
console.log('rol elegido:', await ev(`JSON.stringify({rol: ROL.rol && ROL.rol.nombre, vida: JUG.vida, armas: ARM.lista, pos: [JUG.pos.x, JUG.pos.z].map(x=>+x.toFixed(1)), spawns: MUNDO.spawns.length})`));
await ev(`irMenuPrincipal()`); await p.waitForTimeout(800);
await p.click('[data-rb=nueva]'); await p.waitForTimeout(400); await p.click('[data-rb="cat:comunidad"]'); await p.waitForTimeout(400); await p.screenshot({ path: D + 'c7_comunidad.png' });
console.log('errores:', err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
