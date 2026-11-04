// apuntar con las armas de fuego del juego (idea de Discord: «que se pueda apuntar»). En primera persona, con el secundario
// (clic derecho o el botón de la mira en el celular), para la pistola, el revólver, la SMG, el AK y la escopeta:
//  1. el arma va al centro: la boca queda a ≤ 3 % del ancho de la pantalla del centro y un poco por debajo de la mira
//     (entre 1 y 12 % del alto), y el caño apunta adonde mira la cámara (≤ 2°); sin apuntar está abajo a la derecha
//  2. entra en ~0,2 s (a los 0,35 s ya está al 95 %), la vista se cierra (≥ 15° menos) y al soltar vuelve
//  3. recargando deja de apuntar; el francotirador sigue con su mira telescópica
//  4. en el celular, el botón de la mira aparece con las armas de fuego
//  5. sin errores
// uso: node apuntar.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/apuntar'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
await ev(`(() => { ARM.lista = ['Pistol', 'Revolver', 'Smg', 'Akm', 'Shotgun', 'Sniper', 'PhysicsGun']; JUG.tercera = false; JUG.pitch = 0; for (const e of document.querySelectorAll('#mira')) e.style.visibility = 'hidden';
  // (dónde se ve la boca del arma: x e y en la pantalla, de -1 a 1; y cuánto se aparta el caño de la línea de la mira)
  window.__boca = () => { const v = ARM.v; if (!v || v.mz < 0) return null; v.md.actualizar(); const W = v.md.W[v.mz], m = v3(W[12], W[13], W[14]), r = vsub(m, CAM.pos);
    const z = vdot(r, CAM.fwd), t = Math.tan(CAM.fov * Math.PI / 360), asp = innerWidth / innerHeight;
    let mejor = -1; for (const c of [0, 4, 8]) { const e = v3(W[c], W[c + 1], W[c + 2]); if (e.len() < 1e-6) continue; e.norm(); mejor = Math.max(mejor, Math.abs(vdot(e, CAM.fwd))); }
    return { x: +(vdot(r, CAM.der) / z / (t * asp)).toFixed(3), y: +(vdot(r, CAM.arr) / z / t).toFixed(3), grados: +(Math.acos(Math.min(1, mejor)) * 180 / Math.PI).toFixed(2), fov: +CAM.fov.toFixed(1), k: +(ARM.apK || 0).toFixed(3) }; };
  return 1; })()`);
// (esperar tiempo del juego, no del reloj: con la compu cargada el juego corre más lento que el reloj)
const esperarJuego = async (seg) => { const t0 = await ev(`TIEMPO.t`); await p.waitForFunction((x) => window.__ev(`TIEMPO.t`) >= x, t0 + seg, { timeout: 30000, polling: 16 }); };
const filas = [], fotos = [];
for (const w of ['Pistol', 'Revolver', 'Smg', 'Akm', 'Shotgun']) {
  await ev(`(() => { elegirArma(ARM.lista.indexOf('${w}')); ARM.apunta = false; return 1; })()`); await p.waitForTimeout(1600);
  await esperarJuego(0.2); await p.waitForFunction(() => window.__ev(`!(ARM.ocup > 0)`), null, { timeout: 20000 });
  const quieto = await ev(`__boca()`); await p.locator('#cv').screenshot({ path: `${D}/${w}_0.png` }); fotos.push(`${D}/${w}_0.png`);
  await ev(`(() => { ENT.disparo2 = true; return 1; })()`); await esperarJuego(0.35);
  const a35 = await ev(`__boca()`); await p.waitForTimeout(600); await esperarJuego(0.4);
  const ap = await ev(`__boca()`); await p.locator('#cv').screenshot({ path: `${D}/${w}_1.png` }); fotos.push(`${D}/${w}_1.png`);
  await ev(`(() => { ENT.disparo2 = true; return 1; })()`); await p.waitForTimeout(600); await esperarJuego(1);
  const fin = await ev(`__boca()`);
  filas.push({ w, quieto, a35, ap, fin });
}
console.log(JSON.stringify(filas));
ok('1. apuntando, la boca va al centro (|x| ≤ 0,06 = 3 % del ancho) y un poco abajo (y entre -0,24 y -0,02 = 1-12 % del alto), con el caño hacia la mira (≤ 2°); sin apuntar, a la derecha (x > 0,1)',
  filas.every((f) => f.ap && Math.abs(f.ap.x) <= 0.06 && f.ap.y <= -0.02 && f.ap.y >= -0.24 && f.ap.grados <= 2 && f.quieto && f.quieto.x > 0.1), filas.map((f) => ({ w: f.w, quieto: f.quieto && [f.quieto.x, f.quieto.y], apuntando: f.ap && [f.ap.x, f.ap.y, f.ap.grados] })));
ok('2. entra rápido (a los 0,35 s ≥ 95 %), la vista se cierra ≥ 15° y al volver a tocar vuelve', filas.every((f) => f.a35.k >= 0.95 && f.quieto.fov - f.ap.fov >= 15 && f.fin.k < 0.05 && Math.abs(f.fin.fov - f.quieto.fov) < 1.5), filas.map((f) => ({ w: f.w, k35: f.a35.k, fov: [f.quieto.fov, f.ap.fov, f.fin.fov] })));
// 3. recargar deja de apuntar; el francotirador con su mira
await ev(`(() => { elegirArma(ARM.lista.indexOf('Akm')); return 1; })()`); await p.waitForTimeout(1500);
await ev(`(() => { ENT.disparo2 = true; return 1; })()`); await p.waitForTimeout(500);
const r0 = await ev(`ARM.apK`); await ev(`(() => { ARM.balas.Akm = 3; recargar(); return 1; })()`).catch(() => ev(`(() => { ARM.recargando = 1.5; return 1; })()`)); await p.waitForTimeout(500);
const r1 = await ev(`({ k: ARM.apK, rec: ARM.recargando > 0 })`);
await ev(`(() => { elegirArma(ARM.lista.indexOf('Sniper')); return 1; })()`); await p.waitForTimeout(1500);
await ev(`(() => { ENT.disparo2 = true; return 1; })()`); await p.waitForTimeout(500);
const sn = await ev(`({ zoom: ARM.zoom, k: ARM.apK, fov: +CAM.fov.toFixed(1) })`);
ok('3. recargando deja de apuntar; el francotirador sigue con su mira telescópica', r0 > 0.9 && r1.rec && r1.k < 0.2 && sn.zoom && sn.k === 0 && sn.fov < 30, { r0, r1, sn });
await ev(`(() => { ENT.disparo2 = true; return 1; })()`);
// 4. el botón en el celular
await ev(`(() => { ENT.tactil = true; document.body.classList.add('tactil'); hudDisponer(); elegirArma(ARM.lista.indexOf('Smg')); return 1; })()`); await p.waitForTimeout(800);
const bt = await ev(`(() => { const b = $('bdisp2'); return { ve: !!b && !b.classList.contains('oc'), mira: !!b && /mira/.test(b.querySelector('img').src + (b.querySelector('img').dataset.ico || '')) }; })()`);
await ev(`(() => { elegirArma(ARM.lista.indexOf('PhysicsGun')); return 1; })()`); await p.waitForTimeout(500);
const bt2 = await ev(`(() => { const b = $('bdisp2'); return { ve: !!b && !b.classList.contains('oc') }; })()`);
ok('4. en el celular, con un arma de fuego aparece el botón de la mira', bt.ve, { smg: bt, physgun: bt2 });
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('5. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log('FOTOS ' + fotos.join(' '));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
