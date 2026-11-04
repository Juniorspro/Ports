// huecos en los mapas (pedido: «hay huecos en gm_construct»): lugares donde la pared o el piso chocan pero no se dibujan y
// se ve el cielo a través. Con el cielo apagado y el fondo en magenta, la cámara recorre una grilla del mapa a la altura de
// los ojos y mira en 8 direcciones; por cada píxel magenta se tira un rayo contra el mundo (lo que choca): si pega en algo a
// menos de 60 m, ahí falta geometría dibujada.
//  1. ningún hueco: menos de 0,05 % de los píxeles revisados (y ninguna vista con más de 0,5 %); no cuenta lo que se ve a
//     través de clips o del cielo, ni las vistas con la cámara de la prueba metida adentro de algo (todo caras de atrás)
// uso: node huecos_mapa.mjs URL_HTML [mapa=RB_Construct] [CARPETA_FOTOS] [paso=6]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, MAPA = 'RB_Construct', D = '/tmp/claude-0/huecos', PASO = '6'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, false, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; PREFS.resDin = false; PREFS.res = 50; PREFS.lejos = 400; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await p.waitForTimeout(3000);
// (los puntos: los lugares adonde se puede llegar caminando desde donde aparece el jugador —relleno por pasos de la grilla,
// sin atravesar paredes ni los clips invisibles del mapa, que también frenan al jugador—: afuera de la zona de juego hay
// pisos de choque invisibles a propósito)
const puntos = await ev(`(() => { const s = ${+PASO}, piso = (x, y, z) => { const h = mundoRayo(v3(x, y + 2, z), v3(0, -1, 0), 8); return h && h.n.y > 0.7 ? y + 2 - h.t : null; };
  const y0 = piso(JUG.pos.x, JUG.pos.y, JUG.pos.z); if (y0 === null) return [];
  const vis = new Map(), cola = [[Math.round(JUG.pos.x / s), Math.round(JUG.pos.z / s), y0]], L = []; vis.set(cola[0][0] + ',' + cola[0][1], 1);
  while (cola.length && L.length < 700) { const [i, k, y] = cola.shift(); L.push([+(i * s).toFixed(2), +(y + 1.7).toFixed(2), +(k * s).toFixed(2)]);
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nk = k + dk, key = ni + ',' + nk; if (vis.has(key)) continue;
      const a = v3(i * s, y + 1, k * s), d = v3(di, 0, dk); if (mundoRayo(a, d, s)) continue;   // (una pared o un clip en el medio)
      const ny = piso(ni * s, y, nk * s); if (ny === null || Math.abs(ny - y) > 2.5) continue; vis.set(key, 1); cola.push([ni, nk, ny]); } }
  return L; })()`);
console.log('puntos', puntos.length);
// (qué triángulos del choque son de una malla que se dibuja y cuáles de una de choque sola —clips, el techo del cielo—:
// mirar a través de un clip o del cielo no es un hueco. Mismo orden y mismo filtro que cargarMapa)
await ev(`(() => { const V = []; let t = 0, pt = v3();
  for (const arb of DATA.esc[MUNDO.nombre]) { const md = MUNDO.modelos[DATA.esc[MUNDO.nombre].indexOf(arb)];
    for (let i = 0; i < arb.length; i++) { const x = arb[i]; if (!md.act[i] || !x.col) continue; const W = md.W[i];
      for (const c of x.col) { if (c.tr || c.k !== 'm' || !(c.m >= 0)) continue; const mc = mallaCPU(c.m), P = mc.P, I = mc.I, vw = new Float32Array(P.length);
        for (let k = 0; k < P.length; k += 3) { m4pt(W, P[k], P[k + 1], P[k + 2], pt); vw[k] = pt.x; vw[k + 1] = pt.y; vw[k + 2] = pt.z; }
        let n = 0; for (const s of mc.d.sub) n = Math.max(n, s[0] + s[1]);
        for (let k = 0; k + 2 < n; k += 3) { if (triFino(vw, I[k] * 3, I[k + 1] * 3, I[k + 2] * 3)) continue; V.push(c.m === x.m ? 1 : 0); t++; } } } }
  window.__triDib = V; return V.length === MUNDO.ntMapa ? 1 : 'mal ' + V.length + ' ' + MUNDO.ntMapa; })()`).then((r) => { if (r !== 1) throw new Error('tabla de triángulos: ' + r); });
await ev(`(() => { window.__magenta = true; const cc = R.gl.clearColor.bind(R.gl); R.gl.clearColor = (r, g, b2, a) => window.__magenta ? cc(1, 0, 1, 1) : cc(r, g, b2, a);
  window.__c3d = cielo3dDibujar; cielo3dDibujar = () => false; window.__dc = dibujarCielo; dibujarCielo = () => {};
  for (const e of document.querySelectorAll('#hud, #mira')) e.style.visibility = 'hidden'; JUG.tercera = false; ARM.v = null; return 1; })()`);
const vistas = [];
for (let i = 0; i < puntos.length; i++) {
  const r = await ev(`(() => { const [x, y, z] = ${JSON.stringify(puntos[i])}, out = [];
    for (let k = 0; k < 8; k++) {
      JUG.pos.set(x, y - 0.6, z); JUG.vel.set(0, 0, 0); JUG.yaw = k * Math.PI / 4; JUG.pitch = 0.15; camaraActualizar(0); dibujar();
      const gl = R.gl, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      // (la matriz de la cámara: después de dibujar(), R.vp es la del arma en la mano, a 60°)
      const VPc = new Float32Array(16); m4mul(M4.persp(CAM.fov * Math.PI / 180, W / H, 0.08, vistaLejos() * 1.05), M4.view(CAM.pos, CAM.qVista), VPc); const IV = M4.inv(VPc); let rev = 0, hue = 0, inv = 0, atras = 0, ej = null;
      for (let py = 2; py < H; py += 6) for (let qx = 2; qx < W; qx += 6) {
        rev++; const o = (py * W + qx) * 4; if (!(px[o] > 240 && px[o + 1] < 15 && px[o + 2] > 240)) continue;
        const nx = qx / W * 2 - 1, ny = py / H * 2 - 1;
        const un = (zz) => { const v = [nx, ny, zz, 1], r2 = [0, 0, 0, 0]; for (let c = 0; c < 4; c++) r2[c] = IV[c] * v[0] + IV[4 + c] * v[1] + IV[8 + c] * v[2] + IV[12 + c] * v[3]; return v3(r2[0] / r2[3], r2[1] / r2[3], r2[2] / r2[3]); };
        const p0 = un(-1), p1 = un(1), d = vsub(p1, p0).norm(), h = mundoRayo(p0, d, 60);
        if (!h || h.t <= 0.3) continue;
        if (h.tri !== undefined && h.tri >= 0 && h.tri < __triDib.length && !__triDib[h.tri]) { inv++; continue; }   // (un clip o el cielo)
        hue++; const tn = h.tri >= 0 ? [MUNDO.TN[h.tri * 3], MUNDO.TN[h.tri * 3 + 1], MUNDO.TN[h.tri * 3 + 2]] : [h.n.x, h.n.y, h.n.z];
        if (tn[0] * d.x + tn[1] * d.y + tn[2] * d.z > 0) atras++;
        if (!ej) ej = { px: [qx, H - py], t: +h.t.toFixed(1), p: [p0.x + d.x * h.t, p0.y + d.y * h.t, p0.z + d.z * h.t].map((v) => +v.toFixed(1)), tri: h.tri, caja: !!h.caja, n: tn.map((v) => +v.toFixed(2)), atras: tn[0] * d.x + tn[1] * d.y + tn[2] * d.z > 0 };
      }
      out.push({ k, rev, hue, inv, atras, ej });
    }
    return out; })()`);
  for (const v of r) { vistas.push({ p: puntos[i], ...v }); if (v.hue / v.rev > 0.005 && (globalThis.__nf = (globalThis.__nf || 0) + 1) <= 40) { await ev(`(() => { const [x, y, z] = ${JSON.stringify(puntos[i])}; JUG.pos.set(x, y - 0.6, z); JUG.yaw = ${v.k} * Math.PI / 4; JUG.pitch = 0.15; camaraActualizar(0); return 1; })()`); await p.waitForTimeout(400); await p.locator('#cv').screenshot({ path: `${D}/hueco_${i}_${v.k}.png` }); } }
}
// (si casi todo lo que ve por el agujero son caras de atrás, la cámara de la prueba quedó metida adentro de algo —una
// pared, una columna—: no es un hueco del mapa; se cuenta aparte)
for (const v of vistas) v.dentro = v.hue > 0 && v.atras > v.hue * 0.8;
const sum = (k) => vistas.reduce((s, v) => s + (v.dentro ? 0 : v[k]), 0), rev = vistas.reduce((s, v) => s + v.rev, 0), hue = sum('hue'), malas = vistas.filter((v) => !v.dentro && v.hue / v.rev > 0.005);
console.log('vistas con la cámara metida en algo (no cuentan):', vistas.filter((v) => v.dentro).length);
console.log('a través de clips o del cielo (no cuentan):', +(100 * sum('inv') / rev).toFixed(3), '% · de los huecos, cara de atrás:', hue ? +(100 * sum('atras') / hue).toFixed(1) : 0, '%');
fs.writeFileSync(`${D}/huecos.json`, JSON.stringify(malas, null, 1));
ok('1. ningún hueco (≤ 0,05 % de los píxeles; ninguna vista con más de 0,5 %)', hue / rev <= 0.0005 && !malas.length, { vistas: vistas.length, pct: +(100 * hue / rev).toFixed(3), malas: malas.length, peores: malas.sort((a, c) => c.hue / c.rev - a.hue / a.rev).slice(0, 6).map((v) => [v.p, v.k, +(100 * v.hue / v.rev).toFixed(1), v.ej]) });
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('2. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
