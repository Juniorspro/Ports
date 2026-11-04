// la postura con arma en tercera persona, como la de GMod (lo que se horneó de male_anims.mdl): jugando, con la cadera de
// las caminatas de GMod, el pecho se echaba atrás (hasta 33°) y la pistola, la SMG o la escopeta apuntaban al cielo.
// Para cada arma, quieto y caminando, en el marco del cuerpo:
//  1. quieto: cada tramo (columna, brazos, antebrazos y la línea de los hombros) a ≤ 6° de la postura horneada
//  2. caminando: el pecho a ≤ 12° y los antebrazos a ≤ 16° (la caminata balancea el cuerpo y el número depende del momento
//     de la pisada en que se mide; antes del arreglo eran 50-95°)
//  3. sin errores
// uso: node arma_postura3p.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/postura3p'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
await ev(`(() => {
  const SEG = [['Spine', 'Neck'], ['RightArm', 'RightForeArm'], ['RightForeArm', 'RightHand'], ['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'], ['LeftArm', 'RightArm']];
  const dirs = (P, ix) => { const md = P.md, Rr = md.raiz, l = Math.hypot(Rr[8], Rr[10]) || 1, fx = Rr[8] / l, fz = Rr[10] / l;
    return SEG.map(([a, c]) => { const A = md.W[ix[a]], C = md.W[ix[c]], tx = C[12] - A[12], ty = C[13] - A[13], tz = C[14] - A[14]; return v3(tx * fz - tz * fx, ty, tx * fx + tz * fz).norm(); }); };
  // (la postura horneada: el Hero quieto con la parte de arriba del clip, como en el horneado)
  window.__ref = (n) => { const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); PERS.splice(PERS.indexOf(P), 1); const H = P.hum, md = P.md, ix = huesosMixamo(P.D); md.raiz.set(IDM);
    const idle = humClipNombre('Pose', 'IdleLookAround_loop') || humClipNombre('Pose', 'Idle01'), c = humClipNombre('Pose', n), T = new Float32Array(NV), U = new Float32Array(NV);
    humClip(idle, 0, 1, T); humClip(c, 0, 1, U, false, true); for (let k = 0; k < NV; k++) if (HUM_ARRIBA[k]) T[k] = U[k];
    H.v.set(T); humAplicar(P); md.sucio = true; md.actualizar(); const r = dirs(P, ix); borrarPersona && 0; return r; };
  window.__dif = () => { const P = JUG.cuerpo, ix = huesosMixamo(P.D); P.md.actualizar(); const pa = humClipNombre('Pose', P.poseForzada || POSE_ARMA[armaPoseClave(P.arma)]); if (!pa) return null; const r = __ref(pa.n), d = dirs(P, ix);
    return { pose: pa.n, grados: d.map((v, k) => +(Math.acos(Math.max(-1, Math.min(1, vdot(v, r[k])))) * 180 / Math.PI).toFixed(1)) }; };
  return 1; })()`);
const filas = [];
for (const w of ['Pistol', 'Revolver', 'Smg', 'Akm', 'Shotgun', 'RPG', 'Crowbar']) {
  await ev(`(() => { ARM.lista = ['${w}', 'Hands']; JUG.tercera = true; JUG.pitch = 0; ENT.y = 0; elegirArma(0); return 1; })()`); await p.waitForTimeout(2200);
  const quieto = await ev(`__dif()`); await p.locator('#cv').screenshot({ path: `${D}/${w}_quieto.png` });
  await ev(`(() => { ENT.y = 1; return 1; })()`); await p.waitForTimeout(1500);
  const camina = await ev(`__dif()`); await ev(`(() => { ENT.y = 0; return 1; })()`); await p.waitForTimeout(400);
  filas.push({ w, quieto, camina });
}
console.log(JSON.stringify(filas));
ok('1. quieto: columna, brazos y antebrazos a ≤ 6° de la postura de GMod', filas.every((f) => f.quieto && Math.max(...f.quieto.grados) <= 6), filas.map((f) => [f.w, f.quieto && f.quieto.grados]));
ok('2. caminando: el pecho a ≤ 12° y los antebrazos a ≤ 16°', filas.every((f) => f.camina && f.camina.grados[0] <= 12 && f.camina.grados[2] <= 16 && f.camina.grados[4] <= 16), filas.map((f) => [f.w, f.camina && f.camina.grados]));
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('3. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
