// El campo de visión (FOV) en Ajustes → Renderizado (pedido del Discord «agregar FOV»), en la compu y en un celular
// horizontal:
//  A) el control está, va de FOV_MIN a FOV_MAX y muestra los grados; al moverlo la cámara cambia en el acto (CAM.fov),
//     queda en PREFS y en el guardado (jx_prefs), y con Listo también. Volviendo a abrir el juego sigue el elegido.
//  B) lo que usa CAM.fov sigue andando: la mira (ARM.zoom) va a su zoom fijo de siempre y al sacarla vuelve al elegido; el
//     zoom de un addon (Player:SetFOV) manda mientras está y la sensibilidad del mouse con ese zoom es la proporción con el
//     elegido.
//  C) el arma en la mano no se deforma: con la cámara mirando el cielo (fondo liso), la silueta del arma es la misma con
//     FOV 50, 70 y 110 (se dibuja con su propio campo de 60°); el mundo sí cambia (lo de adelante se agranda o achica).
// uso: node fov.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, DIR = '.'] = process.argv, D = DIR.replace(/\/?$/, '/'); fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const prefs = { bienvenida: true, gfx: 'medio', res: 100, resDin: false, motor: 'webgl2', motorV: 2, fps: false };
const MED = async (p, a, a0, b, b0) => p.evaluate(async (L) => {
  const img = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); };
  const [A, A0, B, B0] = await Promise.all(L.map(img)), W = A.width, H = A.height;
  // (la silueta del arma: lo que cambia entre la foto con el arma y sin ella; se cuenta lo que está en una y no en la otra)
  const en = (X, Y, o) => Math.max(Math.abs(X.data[o] - Y.data[o]), Math.abs(X.data[o + 1] - Y.data[o + 1]), Math.abs(X.data[o + 2] - Y.data[o + 2])) > 16;
  let arma = 0, armaDif = 0, cielo = 0, cieloDif = 0;
  for (let o = 0; o < W * H * 4; o += 4) { const a = en(A, A0, o), b = en(B, B0, o); if (a) arma++; if (a !== b) armaDif++; cielo++; if (en(A0, B0, o)) cieloDif++; }
  return { armaPx: arma, armaCambia: +(100 * armaDif / Math.max(1, arma)).toFixed(2), fondoCambia: +(100 * cieloDif / cielo).toFixed(2) };
}, [a, a0, b, b0].map((x) => x.toString('base64')));

for (const celu of [false, true]) {
  const et = celu ? 'celu' : 'pc';
  let A = await abrir(HTML, celu, null, async (pg) => { await pg.addInitScript((pr) => { try { if (!sessionStorage.getItem('fovPrueba')) { sessionStorage.setItem('fovPrueba', '1'); localStorage.setItem('jx_prefs', JSON.stringify(pr)); } } catch (e) {} }, prefs); });
  let { b, p, err, ev } = A;
  const partida = async () => { await ev(`PREFS.bienvenida = true; GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`); await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'RB_Construct' && JUEGO.estado === 'juego' && JUG.suelo`), null, { timeout: 180000, polling: 300 }); await p.waitForTimeout(2000); };
  await partida();
  const iPG = await ev(`ARM.lista.indexOf('PhysicsGun')`); if (iPG >= 0) await ev(`elegirArma(${iPG}); 1`);
  // --- A) el control ---
  await ev(`abrirPausa(); abrirAjustes('pausa'); 1`); await p.waitForTimeout(300);
  await p.click('[data-aj="r"]'); await p.waitForTimeout(200);
  const ctl = await ev(`(() => { const e = $('aFov'); return e ? { min: +e.min, max: +e.max, v: +e.value, txt: $('aFovv').textContent, fila: e.closest('.ajF').textContent.trim().slice(0, 40), visible: e.getBoundingClientRect().width > 40 } : null; })()`);
  ok(`A ${et}: el control de FOV está en Renderizado, de 50 a 110, en 70°`, ctl && ctl.min === 50 && ctl.max === 110 && ctl.v === 70 && ctl.txt === '70°' && ctl.visible && /FOV/.test(ctl.fila), ctl);
  await p.locator('#aFov').fill('95'); await p.waitForTimeout(50);
  const a1 = await ev(`({ cam: CAM.fov, pref: PREFS.fov, guardado: JSON.parse(localStorage.getItem('jx_prefs')).fov, txt: $('aFovv').textContent })`);
  ok(`A ${et}: al moverlo a 95 la cámara cambia en el acto y queda guardado`, a1.cam === 95 && a1.pref === 95 && a1.guardado === 95 && a1.txt === '95°', a1);
  await p.screenshot({ path: `${D}fov_${et}_ajustes.png` });
  await p.click('#aOk'); await ev(`cerrarPaneles(); 1`); await p.waitForTimeout(800);
  const a2 = await ev(`({ cam: +CAM.fov.toFixed(2), pref: PREFS.fov })`);
  ok(`A ${et}: con Listo y jugando sigue en 95`, Math.abs(a2.cam - 95) < 0.01 && a2.pref === 95, a2);
  // (otra vez el juego: el elegido sigue)
  await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
  ({ ev } = { ev: (s) => p.evaluate((x) => window.__ev(x), s) });
  await partida();
  const a3 = await ev(`({ pref: PREFS.fov, cam: +CAM.fov.toFixed(2) })`);
  ok(`A ${et}: al volver a abrir el juego sigue en 95`, a3.pref === 95 && Math.abs(a3.cam - 95) < 0.5, a3);
  // --- B) lo que usa CAM.fov ---
  const esperaFov = async (f) => { try { await p.waitForFunction((x) => Math.abs(window.__ev('CAM.fov') - x) < 0.3, f, { timeout: 8000, polling: 100 }); } catch (e) {} return ev(`+CAM.fov.toFixed(2)`); };
  await ev(`ARM.zoom = true; 1`); const z1 = await esperaFov(18);
  await ev(`ARM.zoom = false; 1`); const z2 = await esperaFov(95);
  ok(`B ${et}: la mira va a su zoom (18°) y al sacarla vuelve a 95`, Math.abs(z1 - 18) < 0.5 && Math.abs(z2 - 95) < 0.5, { mira: z1, despues: z2 });
  const lua = await ev(`(() => { if (typeof GMA === 'undefined' || typeof gmaSensLua !== 'function') return null; const g = { R: GMA.R, activo: GMA.activo, f: GMA.fovLua, s: GMA.swep }; GMA.R = GMA.R || {}; GMA.activo = true; GMA.fovLua = 19; GMA.swep = null; const r = { fov: gmaFovLua(), sens: +gmaSensLua().toFixed(4) }; GMA.R = g.R; GMA.activo = g.activo; GMA.fovLua = g.f; GMA.swep = g.s; return r; })()`);
  ok(`B ${et}: el zoom de un addon (SetFOV 19) manda y la sensibilidad es 19/95`, !lua || (lua.fov === 19 && Math.abs(lua.sens - 0.2) < 0.001), lua);
  // --- C) el arma no se deforma ---
  // (bien alto sobre el mapa y mirando para arriba: detrás del arma sólo el cielo)
  const pos0 = await ev(`[JUG.pos.x, JUG.pos.y, JUG.pos.z]`);
  await ev(`GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); JUG.congelado = true; JUG.pos.y += 400; JUG.vel.set(0, 0, 0); JUG.pitch = -1.3; JUG.yaw = 0.4; 1`); await p.waitForTimeout(2500);
  // (la silueta del arma en cada FOV: la foto con el arma contra la misma sin el arma, sin los botones encima)
  const fotos = {}, sin = {};
  await ev(`document.body.classList.add('sinUI'); window.__dv = dibujarVista; 1`);
  for (const f of [50, 70, 110, '70b']) {
    await ev(`dibujarVista = window.__dv; PREFS.fov = ${parseInt(f)}; CAM.fov = ${parseInt(f)}; 1`); await p.waitForTimeout(700); fotos[f] = await p.screenshot(); fs.writeFileSync(`${D}fov_${et}_cielo_${f}.png`, fotos[f]);
    await ev(`dibujarVista = () => false; 1`); await p.waitForTimeout(500); sin[f] = await p.screenshot();
  }
  await ev(`dibujarVista = window.__dv; document.body.classList.toggle('sinUI', !!PREFS.ocultarUI); 1`);
  const c0 = await MED(p, fotos[70], sin[70], fotos['70b'], sin['70b']), c1 = await MED(p, fotos[70], sin[70], fotos[50], sin[50]), c2 = await MED(p, fotos[70], sin[70], fotos[110], sin[110]);
  // (control: dos fotos en 70 —el arma se mece apenas y los bordes contra el cielo varían—; con otro FOV no puede cambiar
  // más de 1 punto por encima de eso)
  ok(`C ${et}: la silueta del arma no cambia con el FOV (lo mismo que entre dos fotos en 70°, ±1 %)`, c1.armaPx > 2000 && c1.armaCambia <= c0.armaCambia + 1 && c2.armaCambia <= c0.armaCambia + 1, { control70: c0, '50': c1, '110': c2 });
  // (y el mundo sí: fotos de la cámara real mirando el mapa)
  await ev(`JUG.pos.set(${pos0[0]}, ${pos0[1]}, ${pos0[2]}); JUG.vel.set(0, 0, 0); JUG.pitch = 0.08; 1`); await p.waitForTimeout(1200);
  for (const f of [50, 70, 110]) { await ev(`PREFS.fov = ${f}; CAM.fov = ${f}; 1`); await p.waitForTimeout(700); fs.writeFileSync(`${D}fov_${et}_mapa_${f}.png`, await p.screenshot()); }
  await ev(`PREFS.fov = 70; guardarPrefs(); JUG.congelado = false; 1`);
  const e2 = err.filter((e) => !/WebSocket|ERR_CONNECTION|404|Failed to load resource/.test(e));
  ok(`${et}: sin errores de JS`, !e2.length, e2.slice(0, 5));
  await b.close();
}
console.log(R.every(Boolean) ? `TODO BIEN ${R.length}/${R.length}` : `FALLAN ${R.filter((x) => !x).length}/${R.length}`);
