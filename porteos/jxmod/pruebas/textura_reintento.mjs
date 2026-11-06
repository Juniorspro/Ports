// Texturas que fallan al decodificarse (Discord: en gm_construct el cordón entre la vereda y el pasto salía como una franja
// gris lisa, en un celular mientras se bajaba un mod grande). Si decodificar una textura del paquete falla o no contesta
// —en el celular pasa con poca memoria libre—, el juego tiene que volver a intentarlo. Se simula con la textura del
// cordón (concretefloor028a), mirándolo desde la vereda:
//  1. sin fallas: la textura llega y el cordón se ve con su textura (referencia);
//  2. si falla 2 veces seguidas: igual llega, en ≤ 8 s, y el cordón se ve como en la referencia (≤ 6 de diferencia de
//     color medio en 0–255);
//  3. si la primera vez no contesta nunca: llega en ≤ 20 s;
//  4. queda anotado en la caja negra (para saberlo si pasa en un celular);
//  5. sin errores de JS.
// uso: node textura_reintento.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = ''] = process.argv; if (D) fs.mkdirSync(D, { recursive: true });
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const errores = [];
// (la vereda de gm_construct mirando hacia el edificio: el cordón queda a la derecha)
const POSE = [-30, 0.5, 8, Math.PI, 0.35], PIX = [540, 200];
async function escenario(modo) {
  const { b, p, err, ev } = await abrir(HTML, true);
  // (antes de entrar al mapa: decodificar falla o se cuelga para la textura del cordón, las primeras veces)
  await ev(`(() => { window.__dec = { modo: ${JSON.stringify(modo)}, n: 0, t: [] }; const orig = decodificar;
    decodificar = (blob) => { const i = window.__texCordon; if (i !== undefined && blob.size === (PK.parte('t' + i) || {}).length) { const k = ++__dec.n; __dec.t.push(performance.now());
      if (__dec.modo === 'falla' && k <= 2) return Promise.reject(new Error('prueba: sin memoria'));
      if (__dec.modo === 'cuelga' && k === 1) return new Promise(() => {}); }
      return orig(blob); };
    idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false);
    // (la textura del cordón: el material concretefloor028a del mundo)
    const mi = DATA.mt.findIndex((m) => m && /concretefloor028a/.test(m.n || '')); window.__texCordon = mi >= 0 ? matGL(mi).tex : undefined;
    empezarPartida('RB_Construct'); return window.__texCordon; })()`);
  await p.waitForTimeout(5000);
  await ev(`(() => { JUG.noclip = true; JUG.pos.set(${POSE[0]}, ${POSE[1]}, ${POSE[2]}); JUG.vel.set(0, 0, 0); JUG.yaw = ${POSE[3]}; JUG.pitch = ${POSE[4]}; window.__t0 = performance.now(); return 1; })()`);
  // (cuánto tarda en llegar la textura, mirándola)
  const r = await ev(`new Promise((fin) => { const i = window.__texCordon, t0 = performance.now(); const f = () => { const t = R.tex[i];
    if (t && t.gl && t.gl !== R.texGris) return fin({ llego: true, s: +((performance.now() - t0) / 1000).toFixed(1), intentos: __dec.n });
    if (performance.now() - t0 > 30000) return fin({ llego: false, s: 30, intentos: __dec.n, gris: !!(t && t.gl === R.texGris) });
    setTimeout(f, 100); }; f(); })`);
  await p.waitForTimeout(1500);
  const foto = await p.screenshot({ clip: { x: PIX[0] - 3, y: PIX[1] - 3, width: 6, height: 6 } });
  if (D) await p.screenshot({ path: `${D}/cordon_${modo}.png` });
  const col = await ev(`(async () => { const b = await createImageBitmap(new Blob([new Uint8Array(${JSON.stringify([...foto])})], { type: 'image/png' })); const c = new OffscreenCanvas(b.width, b.height), g = c.getContext('2d'); g.drawImage(b, 0, 0); const d = g.getImageData(0, 0, b.width, b.height).data; const s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k]; return s.map((x) => Math.round(x / (d.length / 4))); })()`);
  const caja = await ev(`(typeof CN !== 'undefined' ? CN.l : []).filter((l) => /textura/.test(l)).slice(-3)`);
  errores.push(...err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently/i.test(x)));
  await b.close();
  return { ...r, col, caja };
}
const ref = await escenario('nada'), falla = await escenario('falla'), cuelga = await escenario('cuelga');
console.log('referencia', JSON.stringify(ref)); console.log('falla 2 veces', JSON.stringify(falla)); console.log('se cuelga', JSON.stringify(cuelga));
const dif = (a, b) => (a && b ? Math.max(...a.map((x, k) => Math.abs(x - b[k]))) : 999);
ok('1. sin fallas: la textura del cordón llega', ref.llego, { s: ref.s, color: ref.col });
ok('2. si falla 2 veces: llega igual en ≤ 8 s y el cordón se ve como en la referencia (≤ 6)', falla.llego && falla.s <= 8 && dif(falla.col, ref.col) <= 6, { s: falla.s, intentos: falla.intentos, color: falla.col, dif: dif(falla.col, ref.col) });
ok('3. si la primera vez no contesta: llega en ≤ 20 s', cuelga.llego && cuelga.s <= 20, { s: cuelga.s, intentos: cuelga.intentos, dif: dif(cuelga.col, ref.col) });
ok('4. queda anotado en la caja negra', falla.caja.length > 0 && cuelga.caja.length > 0, { falla: falla.caja, cuelga: cuelga.caja });
ok('5. sin errores de JS', !errores.length, errores.slice(0, 4));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
