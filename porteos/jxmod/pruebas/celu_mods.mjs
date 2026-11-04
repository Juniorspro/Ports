// celular: HUD con botones de mods, radio y creador
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/';
const D = SALIDA;
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; PREFS.mods = {volar:true, ragdoll:true, scp:true, piano:true, radio:true}; inicioMostrar(true)`);
await p.waitForTimeout(600); await p.screenshot({ path: D + 'u0_inicio.png' });
await ev(`RB.mapaPartida = OFICIALES_MAPAS[0]; RB.mapaCom='megarampa'; RB.horaPartida='normal'; inicioMostrar(false); empezarPartida('FlatGrass')`);
await p.waitForTimeout(4000); await ev(`natScp(false)`); await p.waitForTimeout(800);
await p.screenshot({ path: D + 'u1_hud.png' });
await ev(`natAccion('radio')`); await p.waitForTimeout(4500); await p.screenshot({ path: D + 'u2_radio.png' });
await ev(`radioCerrar(); irMenuPrincipal()`); await p.waitForTimeout(800);
await ev(`inicioPanel('crear')`); await p.waitForTimeout(500); await p.screenshot({ path: D + 'u3_crear.png' });
await ev(`creadorEmpezar('City', null)`); await p.waitForTimeout(4500); await ev(`CREA.tipo = 'piano'; creadorBarraDibujar()`); await p.waitForTimeout(400);
await p.screenshot({ path: D + 'u4_creador.png' });
await ev(`creadorAccion('roles')`); await p.waitForTimeout(300); await ev(`creadorPanelAccion('nuevoRol')`); await p.waitForTimeout(300); await p.screenshot({ path: D + 'u5_roles.png' });
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|compute-pressure/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
