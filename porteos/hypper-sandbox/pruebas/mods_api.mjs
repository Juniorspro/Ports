import { createRequire as _cr } from 'module'; const { chromium } = _cr(import.meta.url)('playwright');
const [, , html] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message.slice(0, 160))); p.on('dialog', (d) => d.accept());
await p.goto('file://' + html); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); await p.waitForTimeout(1500);
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const codigo = `
let ticks = 0;
rb.on('inicio', async (d) => {
  let robo = 'bloqueado'; try { robo = 'LEYO: ' + String(parent.localStorage.getItem('hypper_prefs')).slice(0, 20); } catch (e) {}
  rb.boton('cohete', '🚀'); rb.aviso('mod listo en ' + d.mapa + ' · ' + robo, 4);
  const p = rb.estado.jugador.pos; const id = await rb.crear('Barrel', [p[0] + 3, p[1] + 1, p[2]], {});
  await rb.guardar('veces', ((await rb.leer('veces')) || 0) + 1);
  rb.guardar('info', { id, robo });
});
rb.on('tick', () => { ticks++; if (ticks === 10) rb.guardar('ticks', ticks); });
rb.on('boton', (b) => { if (b.id === 'cohete') rb.jugador({ vel: [0, 25, 0] }); });`;
await ev(`(() => { const m = validarRB({ formato: 'rezobox-mod', nombre: 'Mod de prueba API', efectos: {}, codigo: ${JSON.stringify(codigo)} }); m.id = 'local-prueba'; INST.mods[m.id] = m; PREFS.mods = { 'local-prueba': true }; PREFS.bienvenida = true; inicioMostrar(false); SALA = null; empezarPartida('FlatGrass'); })()`);
await p.waitForTimeout(4000);
await ev('modMenuAbrir()'); await p.waitForTimeout(300);
console.log('botón en el menú MOD:', await p.evaluate(() => [...document.querySelectorAll('#modMenu [data-mm^="api:"]')].map((e) => e.textContent.trim()).join(',')), '· botón MOD visible', await ev("MODM.boton.style.display !== 'none'"));
console.log('aviso:', await p.evaluate(() => document.getElementById('aviso').textContent));
const y0 = await ev('JUG.vel.y'); await p.click('#modMenu [data-mm^="api:"]'); await p.waitForTimeout(250);
console.log('vel.y antes/después del botón:', (+y0).toFixed(2), (+(await ev('JUG.vel.y'))).toFixed(2), 'altura', (+(await ev('JUG.pos.y'))).toFixed(1));
await p.waitForTimeout(1500);
console.log('guardado por el mod:', await ev(`JSON.stringify({ veces: localStorage.getItem('rbmod_local-prueba_veces'), ticks: localStorage.getItem('rbmod_local-prueba_ticks'), info: localStorage.getItem('rbmod_local-prueba_info') })`));
console.log('barril creado:', await ev("OBJS.filter(o => o.nombre === 'Barrel').length"));
await ev('irMenuPrincipal()'); await p.waitForTimeout(400);
console.log('al salir: cuadros', await p.evaluate(() => document.querySelectorAll('iframe[sandbox]').length), 'botones', await ev('MODAPI.botones.size'), 'botón MOD', await ev("MODM.boton.style.display"));
console.log('errores:', err.join(' | ') || 'ninguno');
await b.close();
