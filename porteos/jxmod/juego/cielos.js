// ---------------------------------------------------------------------------------------------------------
// Los cielos de los mapas propios (los del juego y los de JXMod; no los de GMod ni los del Workshop, que traen su cielo
// de caja y siguen con él): un preset por mapa con su degradé, el color del sol, la bruma del horizonte (del color de la
// niebla del mapa: lo lejano se pierde en el cielo sin que se vea la línea) y dos capas de nubes 2D pintadas.
// Las nubes salen de una textura chica de ruido que se arma acá la primera vez (256 × 256, cuatro canales: tres campos de
// «cúmulo» independientes —bultos redondos de celdas más un borde irregular— con la misma media y el mismo desvío, y uno de
// bultitos para los lóbulos del borde). Cada capa mezcla los tres campos con pesos que giran despacio (con la suma de los
// cuadrados en 1: tapan siempre lo mismo), así unas nubes se deshacen mientras otras se forman, como las volumétricas pero
// en 2D; el viento las corre y el detalle va a otra velocidad. La luz, pintada: la densidad un paso hacia el sol (si hacia
// el sol hay menos nube, ese lado está iluminado), el grosor oscurece el centro y los bordes finos brillan mirando al sol
// (el borde plateado). Los colores salen del cielo de ese momento (el ciclo del día, el atardecer, la luna, Cíclope).
// Lo que las hace baratas: como el color de una nube depende sólo de la dirección (no de la cámara), se pintan en una
// textura del cielo («CT», el hemisferio de arriba en proyección equidistante: la misma resolución en ángulo en todos
// lados) que se rehace de a franjas, una por cuadro, entre cuadro y cuadro (sin cortar la pasada de la escena: en los
// celus eso obliga a guardar y volver a traer la pantalla entera). La pasada del cielo de pantalla completa lee esa textura
// una sola vez por punto, en cualquier calidad; lo que cambia con la calidad es la textura y cuánto trabaja la franja:
// Patata de 384 con dos lecturas de ruido (la forma y la luz), Bajo de 512 con tres (y los lóbulos del borde), Medio para
// arriba de 768 o 1024 con cuatro (y la capa alta de cirros). Un salto (otra hora, otro mapa, otra calidad) la rehace
// entera de una.
// ---------------------------------------------------------------------------------------------------------
const CIELO = { tex: null, texGL: null, L: 0, px: null, msTex: 0, dbg: 0, ct: null, ctPend: false, progs: {}, msCT: 0, nCT: 0 };
// capas: cov = cuánto cielo tapa (0..1, sin contar la bruma); tam = tamaño de una nube en el cenit (grados); h = qué tan
// chata es la capa (chica: las nubes se juntan más hacia el horizonte); suave = el ancho del borde; op = opacidad;
// luz = contraste del lado al sol; det = detalle del borde; est = estirada (cirros: pinceladas largas); viento =
// [grados por segundo en el cenit, rumbo]; morf = segundos en que las nubes se rehacen enteras; ciclo = [cuánto sube y
// baja lo que tapa, en cuántos segundos]; som = qué tan oscura es la sombra; borde = el brillo del borde plateado
const CIELOS = {
  // el desierto verde del juego: cúmulos de verano grandes y unos cirros arriba
  Desert: { tipo: 'cumulos', top: [0.15, 0.41, 0.87], mid: [0.80, 0.88, 0.96], bot: [0.55, 0.60, 0.68], sol: [1.0, 0.90, 0.74], bruma: [1, 0.09],
    A: { cov: 0.36, tam: 26, h: 0.2, suave: 0.045, luz: 6, det: 0.15, viento: [0.3, 20], morf: 210, ciclo: [0.05, 260] },
    B: { cov: 0.16, tam: 34, h: 0.42, suave: 0.15, op: 0.5, est: [0.55, 1.45], viento: [0.12, 40], morf: 330 } },
  // las dunas: calima de mediodía, cielo pálido, cirros y alguna nube suelta (la bruma, del gris de su niebla)
  DesertV2: { tipo: 'calima', top: [0.32, 0.55, 0.85], mid: [0.92, 0.91, 0.88], bot: [0.70, 0.64, 0.55], sol: [1.0, 0.88, 0.70], bruma: [1, 0.15],
    A: { cov: 0.14, tam: 14, h: 0.16, suave: 0.05, luz: 6, det: 0.15, viento: [0.22, 200], morf: 180, ciclo: [0.04, 200] },
    B: { cov: 0.32, tam: 40, h: 0.38, suave: 0.16, op: 0.6, est: [0.4, 1.8], viento: [0.1, 215], morf: 300 } },
  // el pasto: cúmulos chicos de buen tiempo, muchos (la bruma, del gris de su niebla)
  FlatGrass: { tipo: 'cumulos', top: [0.19, 0.47, 0.94], mid: [0.88, 0.91, 0.95], bot: [0.56, 0.62, 0.70], sol: [1.0, 0.92, 0.78], bruma: [1, 0.1],
    A: { cov: 0.32, tam: 13, h: 0.2, suave: 0.045, luz: 6, det: 0.15, viento: [0.35, 60], morf: 170, ciclo: [0.05, 230] },
    B: { cov: 0.1, tam: 30, h: 0.42, suave: 0.15, op: 0.45, est: [0.55, 1.45], viento: [0.12, 75], morf: 300 } },
  // la ciudad del juego: una capa partida de estratocúmulos en rollos, gris y blanca
  City: { tipo: 'cobertura', top: [0.32, 0.50, 0.77], mid: [0.85, 0.87, 0.90], bot: [0.58, 0.61, 0.66], sol: [1.0, 0.92, 0.80], bruma: [1, 0.11],
    A: { cov: 0.58, tam: 30, h: 0.2, suave: 0.055, luz: 5, det: 0.18, est: [1.25, 0.85], viento: [0.28, 110], morf: 240, ciclo: [0.06, 280], som: 0.74 },
    B: { cov: 0.22, tam: 30, h: 0.4, suave: 0.15, op: 0.5, est: [0.5, 1.5], viento: [0.12, 125], morf: 320 } },
  // la base: cielo azul profundo con cirros en pinceladas y un manto de borreguitos arriba
  Base: { tipo: 'cirros', top: [0.09, 0.33, 0.82], mid: [0.74, 0.84, 0.95], bot: [0.52, 0.58, 0.68], sol: [1.0, 0.92, 0.80], bruma: [1, 0.08],
    A: { cov: 0.28, tam: 30, h: 0.34, suave: 0.11, op: 0.82, luz: 3, det: 0.22, est: [0.3, 2.0], viento: [0.2, 320], morf: 260, ciclo: [0.05, 300], som: 0.9, borde: 1.4 },
    B: { cov: 0.35, tam: 44, h: 0.45, suave: 0.22, op: 0.3, est: [0.7, 1.3], viento: [0.08, 335], morf: 280 } },
  // la base nueva: cubierto con claros, dramático (la luz del sol más suave y más luz de relleno: coherente con el cielo)
  BaseV2: { tipo: 'cubierto', top: [0.40, 0.49, 0.60], mid: [0.76, 0.79, 0.83], bot: [0.50, 0.53, 0.57], sol: [1.0, 0.94, 0.84], bruma: [1, 0.14],
    luzMapa: { k: 0.72, amb: 1.08 },
    A: { cov: 0.8, tam: 36, h: 0.2, suave: 0.07, luz: 4, det: 0.15, viento: [0.3, 150], morf: 260, ciclo: [0.05, 240], som: 0.66 },
    B: { cov: 0.42, tam: 40, h: 0.38, suave: 0.16, op: 0.55, est: [0.6, 1.4], viento: [0.14, 160], morf: 320, som: 0.7 } },
  // Marte: cielo de caramelo con polvo en el horizonte, el halo del sol azulado (como allá) y nubes finas de hielo
  Mars: { tipo: 'polvo', top: [0.60, 0.40, 0.26], mid: [0.92, 0.78, 0.58], bot: [0.62, 0.46, 0.32], sol: [0.72, 0.84, 1.0], bruma: [1, 0.17],
    A: { cov: 0.2, tam: 28, h: 0.3, suave: 0.1, op: 0.6, luz: 4, det: 0.22, est: [0.4, 1.8], viento: [0.18, 250], morf: 260, ciclo: [0.04, 300], tinte: [1.0, 0.94, 0.9], som: 0.85 },
    B: { cov: 0.14, tam: 44, h: 0.45, suave: 0.16, op: 0.4, est: [0.45, 1.7], viento: [0.08, 265], morf: 340, tinte: [0.95, 0.97, 1.0] } },
  // la estación espacial: estrellas por todos lados y una nebulosa violeta y turquesa
  Space: { tipo: 'nebulosa', espacio: true, estrellas: 1, neb: { c1: [0.55, 0.22, 0.85], c2: [0.10, 0.65, 0.80], k: 0.55, n: [0.35, 0.8, -0.48], ancho: 5, tam: 1.1, polvo: 0.6 } },
  // la llanura: la del afiche, cúmulos grandes con mucha luz
  RB_Llanura: { tipo: 'cumulos', top: [0.13, 0.39, 0.90], mid: [0.80, 0.89, 0.98], bot: [0.56, 0.62, 0.70], sol: [1.0, 0.90, 0.72], bruma: [1, 0.085],
    A: { cov: 0.42, tam: 32, h: 0.18, suave: 0.045, luz: 6, det: 0.15, viento: [0.32, 15], morf: 220, ciclo: [0.05, 250] },
    B: { cov: 0.14, tam: 36, h: 0.42, suave: 0.15, op: 0.45, est: [0.55, 1.45], viento: [0.12, 30], morf: 330 } },
  // las colinas: atardecer dorado (el sol del mapa bajo y naranja, y la luz de relleno tibia: el cielo manda)
  RB_Colinas: { tipo: 'atardecer', top: [0.19, 0.29, 0.58], mid: [1.0, 0.70, 0.47], bot: [0.48, 0.37, 0.36], sol: [1.0, 0.60, 0.30], bruma: [0.92, 0.1],
    luzMapa: { elev: 13, col: [1.25, 0.76, 0.46], amb: 0.92 },
    A: { cov: 0.36, tam: 22, h: 0.18, suave: 0.045, luz: 6, det: 0.15, viento: [0.25, 300], morf: 220, ciclo: [0.05, 260], som: 0.8, borde: 1.6 },
    B: { cov: 0.3, tam: 36, h: 0.4, suave: 0.15, op: 0.65, est: [0.4, 1.8], viento: [0.1, 315], morf: 320 } },
  // la isla: azul tropical, cúmulos de los alisios bajos sobre el mar
  RB_Isla: { tipo: 'tropical', top: [0.05, 0.39, 0.92], mid: [0.68, 0.88, 0.98], bot: [0.42, 0.60, 0.74], sol: [1.0, 0.93, 0.78], bruma: [1, 0.07],
    A: { cov: 0.32, tam: 18, h: 0.11, suave: 0.045, luz: 6, det: 0.15, viento: [0.4, 80], morf: 180, ciclo: [0.05, 220] },
    B: { cov: 0.1, tam: 34, h: 0.42, suave: 0.15, op: 0.4, est: [0.55, 1.45], viento: [0.12, 95], morf: 300 } },
  // la ciudad nueva: bruma urbana gris y un manto de altocúmulos
  RB_Ciudad: { tipo: 'cobertura', top: [0.35, 0.51, 0.73], mid: [0.84, 0.85, 0.87], bot: [0.58, 0.61, 0.66], sol: [1.0, 0.92, 0.80], bruma: [1, 0.14],
    A: { cov: 0.55, tam: 11, h: 0.22, suave: 0.04, luz: 6, det: 0.15, viento: [0.26, 230], morf: 220, ciclo: [0.06, 260], som: 0.76 },
    B: { cov: 0.26, tam: 34, h: 0.4, suave: 0.15, op: 0.5, est: [0.5, 1.5], viento: [0.12, 245], morf: 320 } },
  // el desierto nuevo: azul limpio, cirros en pinceladas y el horizonte tibio de arena
  RB_Desierto: { tipo: 'cirros', top: [0.17, 0.41, 0.86], mid: [0.95, 0.87, 0.72], bot: [0.80, 0.68, 0.52], sol: [1.0, 0.86, 0.64], bruma: [1, 0.12],
    A: { cov: 0.18, tam: 30, h: 0.34, suave: 0.11, op: 0.8, luz: 3, det: 0.22, est: [0.3, 2.1], viento: [0.18, 120], morf: 260, ciclo: [0.05, 300], som: 0.92, borde: 1.4 },
    B: { cov: 0.12, tam: 44, h: 0.45, suave: 0.22, op: 0.25, est: [0.7, 1.3], viento: [0.08, 135], morf: 300 } },
  // la Luna: cielo negro con estrellas y la Vía Láctea
  RB_Luna: { tipo: 'estrellas', espacio: true, estrellas: 1, neb: { c1: [0.55, 0.58, 0.70], c2: [0.75, 0.68, 0.60], k: 0.42, n: [-0.3, 0.55, 0.78], ancho: 9, tam: 1.4, polvo: 0.85 } },
  // la pizzería: de noche siempre, nubes oscuras con la luna detrás (el horizonte se va al negro de su niebla)
  RB_Pizzeria: { tipo: 'noche', noche: 1, top: [0.008, 0.012, 0.03], mid: [0.025, 0.028, 0.045], bot: [0.02, 0.02, 0.025], sol: [0.6, 0.65, 0.8], bruma: [1, 0.12],
    A: { cov: 0.55, tam: 24, h: 0.2, suave: 0.05, luz: 6, det: 0.15, viento: [0.35, 70], morf: 200, ciclo: [0.05, 240] },
    B: { cov: 0.2, tam: 34, h: 0.4, suave: 0.15, op: 0.45, est: [0.55, 1.45], viento: [0.12, 85], morf: 320 } },
};
// los mapas que no están en la lista (los de la tienda, los del creador): sus colores, con cúmulos; en el espacio, estrellas
const CIELO_DEF = { tipo: 'cumulos', propio: true, bruma: [1, 0.1],
  A: { cov: 0.34, tam: 24, h: 0.2, suave: 0.045, luz: 6, det: 0.15, viento: [0.3, 30], morf: 210, ciclo: [0.05, 260] },
  B: { cov: 0.12, tam: 34, h: 0.42, suave: 0.15, op: 0.45, est: [0.55, 1.45], viento: [0.12, 45], morf: 330 } };
const CIELO_DEF_ESP = { tipo: 'estrellas', propio: true, espacio: true, estrellas: 1, neb: { c1: [0.5, 0.5, 0.62], c2: [0.62, 0.55, 0.5], k: 0.22, n: [0.2, 0.7, 0.68], ancho: 9, tam: 1.4, polvo: 0.8 } };
const _fr = (x) => x - Math.floor(x);
// cuantil de la normal (Acklam; error < 1e-4): el umbral de la densidad para que tape tal parte del cielo
function zInv(p) {
  p = clamp(p, 1e-4, 1 - 1e-4);
  if (p > 0.97575) return -zInv(1 - p);
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((-7.78489400243029e-3 * q - 0.322396458041136) * q - 2.40075827716184) * q - 2.54973253934373) * q + 4.37466414146497) * q + 2.93816398269878) / ((((7.78469570904146e-3 * q + 0.32246712907004) * q + 2.445134137143) * q + 3.75440866190742) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((-39.6968302866538 * r + 220.946098424521) * r - 275.928510446969) * r + 138.357751867269) * r - 30.6647980661472) * r + 2.50662827745924) * q / (((((-54.4760987982241 * r + 161.585836858041) * r - 155.698979859887) * r + 66.8013118877197) * r - 13.2806815528857) * r + 1);
}

// ---------------- la textura de las nubes (una vez) ----------------
// cada capa de ruido arma primero su tabla —un gradiente o un punto por celda, con la vuelta del período: la textura se
// repite sin costura— y después recorre los puntos sin sortear nada (256 × 256: ~60 ms en una compu, una sola vez)
function nubesRuido(L) {
  let sem = 9301; const rnd = () => { sem = (Math.imul(sem, 1103515245) + 12345) | 0; return ((sem >>> 8) & 0xffffff) / 16777216; };
  const N = L * L, acc = new Float32Array(N), out = new Uint8Array(N * 4);
  const perlin = (P, a) => {
    const gx = new Float32Array(P * P), gy = new Float32Array(P * P);
    for (let i = 0; i < P * P; i++) { const t = rnd() * 6.2832; gx[i] = Math.cos(t); gy[i] = Math.sin(t); }
    const k = P / L;
    for (let y = 0; y < L; y++) {
      const fy0 = y * k, iy = Math.floor(fy0), fy = fy0 - iy, v = fy * fy * fy * (fy * (fy * 6 - 15) + 10), r0 = iy * P, r1 = ((iy + 1) % P) * P;
      for (let x = 0; x < L; x++) {
        const fx0 = x * k, ix = Math.floor(fx0), fx = fx0 - ix, u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), i1 = (ix + 1) % P;
        const A = gx[r0 + ix] * fx + gy[r0 + ix] * fy, B = gx[r0 + i1] * (fx - 1) + gy[r0 + i1] * fy;
        const C = gx[r1 + ix] * fx + gy[r1 + ix] * (fy - 1), D = gx[r1 + i1] * (fx - 1) + gy[r1 + i1] * (fy - 1);
        const ab = A + (B - A) * u; acc[y * L + x] += a * (ab + (C + (D - C) * u - ab) * v);
      }
    }
  };
  // (celdas de Worley: 1 − la distancia al punto más cercano son bultos redondos, lo «pomposo» de un cúmulo)
  const worley = (P, a) => {
    const px = new Float32Array(P * P), py = new Float32Array(P * P);
    for (let i = 0; i < P * P; i++) { px[i] = rnd(); py[i] = rnd(); }
    const k = P / L;
    for (let y = 0; y < L; y++) {
      const fy0 = y * k, iy = Math.floor(fy0), fy = fy0 - iy;
      for (let x = 0; x < L; x++) {
        const fx0 = x * k, ix = Math.floor(fx0), fx = fx0 - ix; let m = 9;
        for (let j = -1; j <= 1; j++) { const r = ((iy + j + P) % P) * P; for (let i = -1; i <= 1; i++) { const c = r + (ix + i + P) % P, dx = i + px[c] - fx, dy = j + py[c] - fy, d = dx * dx + dy * dy; if (d < m) m = d; } }
        acc[y * L + x] += a * (1 - Math.min(1, Math.sqrt(m)));
      }
    }
  };
  for (let k = 0; k < 4; k++) {
    acc.fill(0);
    // (las masas: bultos grandes y medianos con el borde algo irregular; el detalle: bultitos, los lóbulos del borde de un
    // cúmulo —se lee a 2,7 veces la escala—. Con más ruido fino quedaban todas picadas, como coliflor)
    if (k < 3) { worley(4, 0.55); worley(8, 0.3); perlin(4, 0.4); perlin(8, 0.15); perlin(16, 0.05); }
    else { worley(8, 0.6); worley(16, 0.3); perlin(16, 0.25); }
    // misma media (0,5) y desvío (0,16) en los cuatro: así se mezclan sin que cambie cuánto cielo tapan
    let m = 0, m2 = 0; for (let i = 0; i < N; i++) { m += acc[i]; m2 += acc[i] * acc[i]; } m /= N; const sd = Math.sqrt(Math.max(1e-9, m2 / N - m * m));
    for (let i = 0; i < N; i++) { const v = (0.5 + (acc[i] - m) / sd * 0.16) * 255 + 0.5; out[i * 4 + k] = v < 0 ? 0 : v > 255 ? 255 : v; }
  }
  return out;
}
// la textura en la placa (con mipmaps y repetida). En Patata, de 128 (se arma en un cuarto del tiempo: los celus más
// flojos); si después se sube la calidad, se rehace de 256
function cieloTex() {
  const gl = R.gl; if (!gl) return null;
  const L = GFX.luz >= 1 ? 256 : 128;
  if (CIELO.tex && CIELO.texGL === gl && CIELO.L >= L) return CIELO.tex;
  const t0 = performance.now();
  if (CIELO.tex && CIELO.texGL === gl) gl.deleteTexture(CIELO.tex);
  if (!CIELO.px || CIELO.L !== L) { CIELO.px = nubesRuido(L); CIELO.L = L; }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  // (los cuatro canales son datos, no un color con transparencia: sin premultiplicar ni dar vuelta)
  const pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), fy = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, L, L, 0, gl.RGBA, gl.UNSIGNED_BYTE, CIELO.px);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fy);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null); if (typeof R !== 'undefined') R.texAct = null;
  CIELO.tex = t; CIELO.texGL = gl; CIELO.msTex = performance.now() - t0;
  return t;
}

// ---------------- al entrar a un mapa (mundo.js, antes de guardar la base del ciclo del día) ----------------
// ¿qué preset va? (null: los de GMod y los del Workshop, que siguen con su cielo de caja)
function cieloPresetDe(nombre) {
  const C = R.cielo; if (!C || C.cubo || C.cuboPx) return null;
  if (typeof MAPAS_GMOD !== 'undefined' && MAPAS_GMOD.includes(nombre)) return null;
  if (/^WS_/.test(nombre || '') || (typeof GBSP !== 'undefined' && GBSP.mapas && GBSP.mapas.has(nombre))) return null;
  return CIELOS[nombre] || (MUNDO.espacio ? CIELO_DEF_ESP : CIELO_DEF);
}
// la capa ya con sus cuentas fijas: la escala de la textura (una nube del tamaño pedido en el cenit: los bultos del ruido
// miden un cuarto de la textura y en el cenit un radián son 1/(1+h) del plano), el viento en la textura por segundo
function cieloCapa(X, sem) {
  if (!X) return null;
  const est = X.est || [1, 1], esc = 0.25 * (1 + X.h) / (X.tam * Math.PI / 180), vw = (X.viento ? X.viento[0] : 0.2) * Math.PI / 180 / (1 + X.h) * esc, ang = (X.viento ? X.viento[1] : 0) * Math.PI / 180;
  return { X, ex: esc * est[0], ey: esc * est[1], vx: Math.cos(ang) * vw * est[0], vy: Math.sin(ang) * vw * est[1], f0: _fr(sem * 0.618), f1: _fr(sem * 0.414), f2: _fr(sem * 0.732),
    op: X.op === undefined ? 1 : X.op, som: X.som || 0.82, borde: X.borde === undefined ? 1 : X.borde, det: X.det || 0, luz: X.luz || 5, suave: X.suave || 0.08, h: X.h,
    tinte: X.tinte || [1, 1, 1], morf: X.morf || 220, ciclo: X.ciclo || [0, 1] };
}
function cieloAplicar(nombre, aj) {
  const C = R.cielo, Pr = cieloPresetDe(nombre);
  if (!C) return;
  C.nub = null; C.preset = null;
  // (sin preset —gm_construct, gm_flatgrass, los del Workshop—: la textura del cielo se suelta, hasta 4 MB menos en la placa)
  if (!Pr) { const X = CIELO.ct; if (X && X.gl === R.gl) { R.gl.deleteTexture(X.tex); R.gl.deleteFramebuffer(X.fb); } CIELO.ct = null; return; }
  const sem = (typeof evtHash === 'function' ? evtHash(nombre + '~cielo') : 0.37) * 100;
  C.preset = Object.assign({ nombre: CIELOS[nombre] ? nombre : 'def' }, Pr);
  C.nub = { Pr, A: cieloCapa(Pr.A, sem), B: cieloCapa(Pr.B, sem + 7.3) };
  if (CIELO.ct) CIELO.ct.lleno = false;   // (lo pintado era del mapa anterior: hasta rehacerla, el degradé solo)
  if (!Pr.propio) {
    for (const k of ['top', 'mid', 'bot', 'sol']) if (Pr[k]) C[k] = Pr[k].slice();
    if (Pr.exp) C.exp = Pr.exp.slice();
  }
  // la bruma del horizonte es la niebla del mapa: su color pasa a ser el del horizonte del cielo (sin línea entre lo lejano
  // y el cielo). La pizzería y el espacio siguen con su niebla negra
  if (!Pr.propio && !Pr.espacio && !MUNDO.espacio && R.niebla) R.niebla.c = C.mid.slice();
  // la luz del mapa, coherente con el cielo: el atardecer baja el sol y lo pone naranja; el cubierto lo suaviza
  const Lz = Pr.luzMapa;
  if (Lz) {
    if (Lz.elev !== undefined) { const az = Math.atan2(R.sol.x, R.sol.z), el = Lz.elev * Math.PI / 180; R.sol.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).norm(); }
    if (Lz.col) R.solCol = Lz.col.slice(); else if (Lz.k) R.solCol = R.solCol.map((x) => x * Lz.k);
    const ai = (aj && aj.ai) || 1, a = Lz.amb || 1;
    if (Lz.col) { R.ambS = [0, 1, 2].map((k) => (C.top[k] * 0.4 + C.mid[k] * 0.6) * ai * 0.72 * a); R.ambG = [0, 1, 2].map((k) => (C.mid[k] * 0.45 + C.bot[k] * 0.3) * ai * 0.62 * a); }
    else { R.ambS = R.ambS.map((x) => x * a); R.ambG = R.ambG.map((x) => x * a); }
  }
  // (la textura ya, al entrar: la entrada al mapa es una pausa; no en el primer cuadro)
  try { cieloTex(); } catch (e) { if (typeof cnAnotar === 'function') cnAnotar('cielo', String(e && e.message || e).slice(0, 160)); }
}

// ---------------- la textura del cielo con las nubes (CT) ----------------
// la pasada que la pinta: cada punto es una dirección del hemisferio de arriba (proyección equidistante: el centro es el
// cenit y el borde el horizonte); en el espacio, la esfera entera (la nebulosa no necesita tanto detalle). Sale el color de
// las nubes en gamma dividido por 1,5 (lugar para el borde plateado, que pasa de blanco), premultiplicado por cuánto tapan,
// y cuánto tapan; en Patata y Bajo (TODO), el cielo de arriba entero
const VS_NUBCT = `
layout(location=0) in vec2 aP; out vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.0, 1.0); }`;
const FS_NUBCT = `
precision highp float; in vec2 vP; out vec4 o; uniform sampler2D uNubT;
#ifdef ESPACIO
uniform vec4 uNe1, uNe2, uNb, uNc1; uniform vec3 uNc2;
#else
uniform vec3 uLuz; uniform vec4 uA, uAo, uAm, uAe, uAc1, uAc2, uAc3;
#if NUB >= 3
uniform vec4 uB, uBo, uBm, uBe, uBc1, uBc2;
#endif
#ifdef TODO
uniform vec3 uTop, uMid, uNie, uSol, uSolC; uniform vec2 uExp; uniform vec4 uK2, uK3;
#endif
#endif
// (el borde de la nube nunca más fino que punto y medio de la textura: donde la densidad cambia rápido —lejos, o en los
// lóbulos— el escalón de un punto quedaba en serrucho al agrandarse en la pantalla; el medio del borde no se mueve)
#ifdef DERIV
#define AAN(x) (fwidth(x) * 0.75)
#else
#define AAN(x) 0.0
#endif
void main(){
  float r = length(vP);
  // (afuera del disco no hay cielo: nada que leer. Con el cielo entero, el color del horizonte, para que el filtro de la
  // textura no oscurezca el borde)
  if (r > 1.0) {
#ifdef TODO
    vec3 d0 = vec3(vP / r, 0.0).xzy; float s0 = max(dot(d0, uSol), 0.0), s02 = s0 * s0, s04 = s02 * s02;
    o = vec4(min(mix(uMid, uNie, uK2.z) + uSolC * (s04 * s04 * s04 * 0.12 * uK3.x), vec3(1.0)), 0.0);
#else
    o = vec4(0.0);
#endif
    return;
  }
#ifdef ESPACIO
  float th = r * 3.14159265;
#else
  float th = r * 1.5707963;
#endif
  float sn = sin(th) / max(r, 1e-4);
  vec3 d = vec3(vP.x * sn, cos(th), vP.y * sn);
#ifdef ESPACIO
  // la nebulosa: una banda sobre un círculo máximo; la forma y el color, de la textura; el polvo oscuro la corta
  vec2 un = vec2(dot(d, uNe1.xyz) + uNe1.w, dot(d, uNe2.xyz));
  vec4 tn = texture(uNubT, un);
  float bd = dot(d, uNb.xyz), banda = exp(-bd * bd * uNb.w);
#if NUB >= 2
  float pol = smoothstep(0.5, 0.72, texture(uNubT, un * 2.3 + 0.37).b) * uNe2.w * banda;
#else
  float pol = 0.0;
#endif
  float dn = smoothstep(0.3, 0.85, tn.r * 0.7 + tn.a * 0.3) * banda;
  vec3 nb = mix(uNc1.rgb, uNc2, tn.g); nb = nb * nb * (0.74 + 0.26 * nb) * (dn * uNc1.w * (1.0 - pol * 0.7));
  o = vec4(sqrt(nb * 2.0), pol);                                            // (luz en lineal, guardada en raíz: más escalones en lo oscuro)
#else
  float y = d.y, yp = max(y, 0.0), sl = max(dot(d, uLuz), 0.0), sl2 = sl * sl, sl4 = sl2 * sl2, sl8 = sl4 * sl4;
  vec3 cB = uAc2.rgb; float aB = 0.0;
#if NUB >= 3
  // la capa alta (cirros o un manto fino), detrás de la de abajo: una lectura, sin luz propia
  vec2 qb = d.xz / (yp + uB.y);
  float nb = dot(vec4(texture(uNubT, qb * uBe.xy + uBo.xy).rgb, 1.0), uBm);
  float eb = smoothstep(uB.z, uB.z + uB.w * 3.0, nb), wb = AAN(nb);
  aB = smoothstep(uB.z - wb, uB.z + uB.w + wb, nb) * smoothstep(0.01, 0.2, y) * uBc1.w;
  cB = mix(uBc1.rgb, uBc2.rgb, eb * uBc2.w) + uAc3.rgb * ((1.0 - eb) * sl4 * sl2);
#endif
  // la capa de abajo, la de las nubes grandes: los tres campos mezclados (uAm) y los lóbulos, que van a otra velocidad
  vec2 q = d.xz / (yp + uA.y), qe = q * uAe.xy, uv = qe + uAo.xy;
  float n = dot(vec4(texture(uNubT, uv).rgb, 1.0), uAm);
#if NUB >= 2
  n += (texture(uNubT, uv * 2.71 + uAo.zw).a - 0.5) * uAc3.w;
#endif
  float w = AAN(n), a = smoothstep(uA.z - w, uA.z + uA.w + w, n) * smoothstep(0.0, 0.12, y), esp = smoothstep(uA.z, uA.z + uA.w * 4.0, n);
  // la luz: la densidad un paso hacia el sol (o la luna); si hacia allá hay menos nube, este lado está iluminado
  float nl = dot(vec4(texture(uNubT, uv + normalize(uAe.zw - qe + 1e-5) * 0.035).rgb, 1.0), uAm);
  float lu = smoothstep(0.15, 0.85, 0.5 + (n - nl) * uAc2.w) * (1.0 - 0.4 * esp) + 0.18 * (1.0 - esp);
  vec3 nc = mix(uAc2.rgb, uAc1.rgb, clamp(lu, 0.0, 1.0));
  // el borde plateado: lo fino del borde, mucho más mirando hacia el sol (o la luna)
  nc += uAc3.rgb * ((1.0 - esp) * smoothstep(uA.z, uA.z + uA.w * 1.5, n) * (0.06 + sl8 * 2.5));
  float aA = a * uAc1.w, aT = aA + aB * (1.0 - aA);
  vec3 col = (nc * (aA + 0.001) + cB * aB * (1.0 - aA)) / (aT + 0.001);
#ifdef VERNUB
  o = vec4(aA, aB, 0.0, 1.0);                                               // (para las pruebas: cuánto tapa cada capa)
#elif defined(TODO)
  // Patata y Bajo (sin luz física, en gamma): el cielo de arriba entero queda acá, como lo dibujaba la pasada del cielo
  // —el degradé, las nubes, la bruma del color de la niebla y el halo del sol—; la pasada de pantalla completa sólo lo lee
  vec3 c = mix(uMid, uTop, pow(yp, uExp.x));
  c = mix(c, col, aT);
  float hx = yp * uK2.w; c = mix(c, uNie, uK2.z / (1.0 + hx + hx * hx));
  float s = max(dot(d, uSol), 0.0), s2 = s * s, s4 = s2 * s2;
  c += uSolC * (s4 * s4 * s4 * 0.12 * uK3.x * (1.0 - 0.6 * aT));
  o = vec4(min(c, vec3(1.0)), aT);
#else
  // (premultiplicado por lo que tapa: el filtro de la textura mezcla bien los bordes; sin premultiplicar, el color de afuera
  // de la nube se colaba en el borde y dejaba muescas oscuras de un punto en las esquinas)
  o = vec4(min(col * 0.6667, vec3(1.0)) * aT, aT);
#endif
#endif
}`;
// la calidad de la textura del cielo: su lado y cuánto trabaja cada punto (NUB: 1 Patata, 2 Bajo, 3 Medio para arriba)
function cieloNubCalidad() {
  const n = GFX.luz >= 2 ? 3 : GFX.luz >= 1 ? 2 : 1;
  // (Patata en 384: con 256 las nubes bajas, aplastadas cerca del horizonte, quedaban en escalones)
  let S = n === 3 ? (GFX.hdr ? 1024 : 768) : n === 2 ? 512 : 384;
  if (GFX.memBaja) S = Math.min(S, 512);
  return { n, S };
}
// la textura y su framebuffer (se rehacen si cambia el lado); recién hecha está vacía (transparente) hasta que se pinta
function cieloCT() {
  const gl = R.gl, Q = cieloNubCalidad(); let X = CIELO.ct;
  if (X && X.gl === gl && X.S === Q.S) { X.n = Q.n; return X; }
  if (X && X.gl === gl) { gl.deleteTexture(X.tex); gl.deleteFramebuffer(X.fb); }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Q.S, Q.S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer(), fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb0); gl.bindTexture(gl.TEXTURE_2D, null); R.texAct = null;
  if (!ok) { gl.deleteTexture(t); gl.deleteFramebuffer(fb); CIELO.ct = null; return null; }
  return (CIELO.ct = { gl, S: Q.S, n: Q.n, tex: t, fb, fila: 0, lleno: false, firma: null, clave: '' });
}
// (lo que, si salta, obliga a rehacerla entera: los colores del cielo, la luz, la noche, el preset)
function cieloFirma(C) {
  const N = C.nub, f = [N ? N.Pr : null, R.noche || 0, R.sol.x, R.sol.y, R.sol.z].concat(C.top, C.mid, C.sol, R.solCol || [], R.niebla ? R.niebla.c : []);
  return f;
}
// la franja de cada cuadro (en filas) y la clave de la pasada que pinta la textura (la textura sirve si se pintó con ésa)
// (las franjas: la textura entera se rehace en medio segundo de juego, a cualquier ritmo de cuadros —a 60 por segundo, de a
// 1/30; a 20, de a 1/10—: así el borde entre la franja recién hecha y la más vieja nunca separa más de lo que las nubes
// se corren en medio segundo, un punto de la pantalla o menos. Lo mínimo, 1/32 —con más cuadros por segundo no hace falta
// menos—; lo máximo, 1/6)
const cieloFranja = (S) => Math.max(8, Math.ceil(S * clamp((TIEMPO.dt || 1 / 60) / 0.5, 1 / 32, 1 / 6)));
// (la ráfaga de un salto: un sexto de la textura por cuadro; las de Medio para arriba, un octavo)
const cieloRafaga = (S) => Math.ceil(S / (S >= 768 ? 8 : 6));
const cieloCTTodo = (n, esp) => !esp && n <= 2 && R.salida === 'gam';
const cieloCTClave = (n, esp) => 'ct|' + n + (esp ? 'e' : '') + (cieloCTTodo(n, esp) ? 't' : '') + (CIELO.dbg ? 'd' : '');
// ¿la textura está pintada para lo que se va a dibujar? (si no, ese cuadro va el degradé solo: con el cielo entero en la
// textura, leerla vacía daría el cielo negro)
function cieloCTListo(n, esp) { const X = CIELO.ct; return !!(X && X.gl === R.gl && X.lleno && X.clave === cieloCTClave(esp ? Math.min(n, 2) : n, esp)); }
function cieloFirmaSalta(a, b) {
  if (!a || !b || a.length !== b.length || a[0] !== b[0]) return true;
  for (let i = 1; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 0.02) return true;
  return false;
}
// pinta una franja de filas (o toda, si hace falta) de la textura del cielo. Se llama entre cuadro y cuadro (dibujarCielo
// la pide con requestAnimationFrame: el juego ya pidió su cuadro antes, así esto va después de dibujarlo)
function cieloCTPaso(todo) {
  const gl = R.gl, C = R.cielo; if (!gl || !C || !C.nub || R.perdido) return;
  const t0 = performance.now(); if (!cieloTex()) return;
  const X = cieloCT(); if (!X) return;
  const esp = !!C.nub.Pr.espacio, n = esp ? Math.min(X.n, 2) : X.n, todo1 = cieloCTTodo(n, esp);
  const k = cieloCTClave(n, esp);
  let P = CIELO.progs[k];
  if (!P || P.gl !== gl) {
    try { P = shader(VS_NUBCT, FS_NUBCT, ['NUB=' + n].concat(esp ? ['ESPACIO'] : []).concat(todo1 ? ['TODO'] : []).concat(CIELO.dbg ? ['VERNUB'] : [])); P.gl = gl; CIELO.progs[k] = P; }
    catch (e) { if (typeof cnAnotar === 'function') cnAnotar('cielo', String(e && e.message || e).slice(0, 200)); C.nub = null; return; }
  }
  // si lo que tiene no sirve (otro mapa, otra calidad, recién hecha) se rehace entera ya: esos momentos ya son una pausa
  // (la carga del mapa, el cambio de calidad, que recompila todo) y mientras tanto no hay nubes que mostrar. Un salto jugando
  // (otra hora del día, el rojo de Cíclope) la rehace en ráfaga, de a un sexto u octavo por cuadro, así ningún cuadro se
  // lleva la textura entera (en Alto, 1024 × 1024 con cuatro lecturas por punto); mientras, se sigue viendo la anterior.
  // todo (las pruebas): entera, ya
  const firma = cieloFirma(C);
  if (X.clave !== k || !X.lleno) todo = true;
  else if (cieloFirmaSalta(firma, X.firma) && !X.rafaga) { X.rafaga = true; X.filaR = 0; }
  X.firma = firma;
  // (fuera de la ráfaga, una franja por cuadro: cieloFranja)
  let y0, alto;
  if (todo) { y0 = 0; alto = X.S; }
  else if (X.rafaga) { y0 = X.filaR; alto = Math.min(cieloRafaga(X.S), X.S - y0); }
  else { y0 = X.fila; alto = Math.min(cieloFranja(X.S), X.S - X.fila); }
  const fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp0 = gl.getParameter(gl.VIEWPORT), dt = gl.isEnabled(gl.DEPTH_TEST), bl = gl.isEnabled(gl.BLEND), cu = gl.isEnabled(gl.CULL_FACE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, X.fb); gl.viewport(0, 0, X.S, X.S);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  if (!todo) { gl.enable(gl.SCISSOR_TEST); gl.scissor(0, y0, X.S, alto); }
  gl.useProgram(P.p); R.progAct = null;
  cieloCTUniformes(P, n, esp, todo1);
  gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); R.vaoAct = null;
  if (!todo) gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb0); gl.viewport(vp0[0], vp0[1], vp0[2], vp0[3]);
  if (dt) gl.enable(gl.DEPTH_TEST); if (bl) gl.enable(gl.BLEND); if (cu) gl.enable(gl.CULL_FACE);
  if (todo) { X.rafaga = false; X.fila = 0; X.lleno = true; X.clave = k; }
  else if (X.rafaga) { X.filaR = y0 + alto; if (X.filaR >= X.S) { X.rafaga = false; X.lleno = true; X.clave = k; X.fila = 0; } }
  else X.fila = (X.fila + alto) % X.S;
  CIELO.msCT = performance.now() - t0; CIELO.nCT++;
}
// dibujarCielo la llama en cada cuadro: pide la franja siguiente para después de este cuadro (una sola vez)
function cieloCTPedir() {
  if (CIELO.ctPend) return;
  CIELO.ctPend = true;
  requestAnimationFrame(() => { CIELO.ctPend = false; try { cieloCTPaso(false); } catch (e) { if (typeof cnAnotar === 'function') cnAnotar('cielo', String(e && e.message || e).slice(0, 160)); } });
}

// ---------------- los uniformes ----------------
const _CU = { m: new Float32Array(4), a: new Float32Array(4), o: new Float32Array(4), e: new Float32Array(4), c1: new Float32Array(4), c2: new Float32Array(4), c3: new Float32Array(4) };
// los colores de las nubes (en gamma) del cielo de este momento: el lado al sol, blanco tibio que se va al color del sol
// cuanto más naranja es (el atardecer); la sombra, gris azulada del cielo; el borde, del color del sol. De noche, la luna
function cieloPaleta(C, noche) {
  const sol = C.sol, sat = clamp((sol[0] - sol[2]) / Math.max(1e-3, sol[0]), 0, 1), lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  let luz = _mix3([1, 1, 1], sol, 0.22 + 0.6 * sat * sat);
  const cm = _mix3(C.top, C.mid, 0.55), l = lum(cm);
  let som = _mix3(cm, [l, l, l], 0.3);
  // (el sol que queda: con el sol puesto el lado iluminado se apaga hacia la sombra)
  const B = typeof DIA !== 'undefined' && DIA.base; let kS = B && B.solCol ? clamp(lum(R.solCol) / Math.max(1e-3, lum(B.solCol)), 0, 1) : 1;
  // (las nubes están altas: siguen alumbradas por el sol un rato después de que se pone, del color del atardecer —el
  // arrebol—; antes del amanecer, igual)
  const hs = B && !MUNDO.espacio ? Math.sin((DIA.hora - 6) / 12 * Math.PI) : 1;   // (la altura del sol en su arco: 1 a las 12)
  kS = Math.max(kS, sstep(-0.25, 0.0, hs));
  // (con el sol bajo la luz que llega a las nubes viene roja —cruza mucho aire—: rosada y naranja, más cuanto más bajo)
  luz = _mix3(luz, [1.0, 0.56, 0.42], 0.7 * (1 - sstep(-0.06, 0.22, hs)));
  luz = _mix3(som.map((x) => x * 1.08), luz, kS);
  // (el borde plateado es del sol: con el sol puesto se apaga, si no las nubes quedan recortadas con una línea clara)
  let borde = sol.map((x) => x * (0.25 + 0.75 * kS));
  if (noche > 0) {
    luz = _mix3(luz, [0.2, 0.23, 0.3], noche); som = _mix3(som, [C.top[0] * 1.6 + 0.015, C.top[1] * 1.6 + 0.018, C.top[2] * 1.6 + 0.03], noche);
    borde = _mix3(borde, [0.4, 0.45, 0.6], noche);
  }
  return { luz, som, borde, kS };
}
const cieloNoche = (C) => Math.max(R.noche || 0, (C.nub && C.nub.Pr.noche) || 0);
// la luz de las nubes: el sol, y de noche la luna
function cieloLuz(noche) {
  const luna = R.luna || v3(-R.sol.x, Math.abs(R.sol.y), -R.sol.z);
  return { luna, lz: v3(R.sol.x + (luna.x - R.sol.x) * noche, R.sol.y + (luna.y - R.sol.y) * noche, R.sol.z + (luna.z - R.sol.z) * noche).norm() };
}
// la pasada de pantalla completa (gl.js, dibujarCielo): el degradé, el sol, las estrellas, la bruma y la textura del cielo
function cieloUniformes(P, IVP, sal, nub, esp) {
  const gl = R.gl, C = R.cielo, N = C.nub, Pr = N ? N.Pr : null, u = P.u, lin = sal > 0, T = TIEMPO.t, cK = R.cieloK || 1;
  const L = lin && R.lin ? R.lin : null, noche = cieloNoche(C), { luna } = cieloLuz(noche);
  gl.uniformMatrix4fv(u.uIVP, false, IVP);
  gl.uniform3fv(u.uTop, C.top); gl.uniform3fv(u.uMid, C.mid); gl.uniform3fv(u.uBot, C.bot); gl.uniform2fv(u.uExp, C.exp);
  gl.uniform3f(u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(u.uSolC, L ? L.cieloSol : C.sol); gl.uniform3f(u.uCam, R.camPos.x, R.camPos.y, R.camPos.z);
  if (u.uLuna) gl.uniform3f(u.uLuna, luna.x, luna.y, luna.z);
  // la bruma: el color de la niebla del mapa (así lo lejano y el horizonte son lo mismo); fuerza y altura del preset
  const br = (Pr && Pr.bruma) || [0, 10];
  if (u.uNie) gl.uniform3fv(u.uNie, L ? L.nieC : R.niebla.c);
  const aire = esp || (MUNDO.espacio && !(Pr && Pr.noche)) ? 0 : 1;
  if (u.uK) gl.uniform4f(u.uK, R.expo, cK, esp ? (Pr && Pr.estrellas) || 1 : noche, 0.00012 + (C.solTam || 0.3) * 0.0004);
  if (u.uK2) gl.uniform4f(u.uK2, aire, _fr(T / 209.44) * 209.44, esp ? 0 : br[0], 1 / Math.max(0.01, br[1]));
  if (u.uK3) gl.uniform4f(u.uK3, 1 - noche, esp ? 0 : noche, lin ? cK * (esp ? 1 : 1.22) : 1, 0);
  if (!nub || !CIELO.ct) return;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, CIELO.ct.tex); R.texAct = null; if (u.uNubCT) gl.uniform1i(u.uNubCT, 0);
  // la grieta del evento alumbra de azul las nubes que tiene cerca (más cuando late)
  if (u.uGri) {
    const on = typeof EVT !== 'undefined' && EVT.grieta && JUEGO.estado === 'juego' && MUNDO.nombre === EVT.mapa && (typeof evtActivo !== 'function' || evtActivo());
    gl.uniform4f(u.uGri, EVT.dir.x, EVT.dir.y, EVT.dir.z, on ? (lin ? 1 : 0.5) * (0.4 + (EVT.pulso || 0) * 1.4) : 0);
  }
}
// la pasada de la textura del cielo: cada capa con su mezcla de campos, su viento, su umbral, su luz y sus colores
function cieloCTUniformes(P, nub, esp, todo) {
  const gl = R.gl, C = R.cielo, N = C.nub, Pr = N.Pr, u = P.u, T = TIEMPO.t;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, CIELO.tex); R.texAct = null; if (u.uNubT) gl.uniform1i(u.uNubT, 0);
  if (esp) { cieloUniformesEspacio(P, Pr, T); return; }
  const noche = cieloNoche(C), { lz } = cieloLuz(noche), pal = cieloPaleta(C, noche);
  if (u.uLuz) gl.uniform3f(u.uLuz, lz.x, lz.y, lz.z);
  if (todo && u.uMid) {
    // (el cielo entero, en gamma, como lo dibujaba la pasada del cielo en Patata y Bajo)
    const br = Pr.bruma || [0, 10];
    gl.uniform3fv(u.uTop, C.top); gl.uniform3fv(u.uMid, C.mid); gl.uniform2fv(u.uExp, C.exp); gl.uniform3fv(u.uNie, R.niebla.c);
    gl.uniform3f(u.uSol, R.sol.x, R.sol.y, R.sol.z); gl.uniform3fv(u.uSolC, C.sol);
    gl.uniform4f(u.uK2, 0, 0, br[0], 1 / Math.max(0.01, br[1])); gl.uniform4f(u.uK3, 1 - noche, 0, 0, 0);
  }
  const capa = (Cp, pre, conDet) => {
    if (!Cp || !u['u' + pre]) return;
    const X = Cp.X, a = _CU.a, o = _CU.o, m = _CU.m, e = _CU.e, c1 = _CU.c1, c2 = _CU.c2, c3 = _CU.c3;
    // los tres campos con pesos que giran: unas nubes se forman mientras otras se deshacen (la suma de los cuadrados en 1)
    const th = 6.2832 * _fr(T / Cp.morf + Cp.f0);
    let w0 = Math.max(0, Math.cos(th)), w1 = Math.max(0, Math.cos(th - 2.0944)), w2 = Math.max(0, Math.cos(th - 4.1888)); const wn = Math.hypot(w0, w1, w2) || 1;
    w0 /= wn; w1 /= wn; w2 /= wn; m[0] = w0; m[1] = w1; m[2] = w2; m[3] = 0.5 - 0.5 * (w0 + w1 + w2);
    // lo que tapa (sube y baja despacio) → el umbral de la densidad (el desvío crece con el detalle, si va)
    const cov = clamp(X.cov + Cp.ciclo[0] * Math.sin(6.2832 * _fr(T / Cp.ciclo[1] + Cp.f1)), 0.02, 0.97);
    const sd = 0.16 * Math.sqrt(1 + (conDet ? Cp.det * Cp.det : 0));
    a[0] = 0; a[1] = Cp.h; a[2] = 0.5 + zInv(1 - cov) * sd - Cp.suave / 2; a[3] = Cp.suave;
    // el viento (la vuelta de la textura es 1: así los números quedan chicos aunque la partida dure horas)
    o[0] = _fr(T * Cp.vx + Cp.f1); o[1] = _fr(T * Cp.vy + Cp.f2); o[2] = _fr(T * (Cp.vx * 1.7 - Cp.vy * 0.5) + Cp.f0); o[3] = _fr(T * (Cp.vy * 1.7 + Cp.vx * 0.5) + Cp.f2);
    // dónde está la luz (sol o luna) en el plano de la capa: hacia ahí se mide si hay menos nube
    const yy = Math.max(lz.y, 0.03) + Cp.h; e[0] = Cp.ex; e[1] = Cp.ey; e[2] = lz.x / yy * Cp.ex; e[3] = lz.z / yy * Cp.ey;
    const tl = Cp.tinte;
    for (let i = 0; i < 3; i++) { c1[i] = pal.luz[i] * tl[i]; c2[i] = pal.som[i] * Cp.som * tl[i]; c3[i] = pal.borde[i] * 0.45 * Cp.borde; }
    c1[3] = Cp.op; c2[3] = pre === 'A' ? Cp.luz : 0.55; c3[3] = Cp.det;
    gl.uniform4fv(u['u' + pre], a); gl.uniform4fv(u['u' + pre + 'o'], o); gl.uniform4fv(u['u' + pre + 'm'], m); gl.uniform4fv(u['u' + pre + 'e'], e);
    gl.uniform4fv(u['u' + pre + 'c1'], c1); gl.uniform4fv(u['u' + pre + 'c2'], c2); if (u['u' + pre + 'c3']) gl.uniform4fv(u['u' + pre + 'c3'], c3);
  };
  if (nub >= 3) capa(N.B, 'B', false);
  capa(N.A, 'A', nub >= 2);   // (la de abajo al final: su borde plateado, uAc3, lo usa también la de arriba)
}
// el espacio: la nebulosa en una banda sobre un círculo máximo (su color sale de la textura) y polvo oscuro adentro
function cieloUniformesEspacio(P, Pr, T) {
  const gl = R.gl, u = P.u, B = Pr.neb; if (!B) return;
  const n = v3(B.n[0], B.n[1], B.n[2]).norm(), e1 = vcross(Math.abs(n.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), n).norm(), e2 = vcross(n, e1).norm(), k = B.tam;
  // (la proyección lleva también algo de la normal: así los dos lados de la banda no quedan en espejo)
  if (u.uNe1) gl.uniform4f(u.uNe1, (e1.x + n.x * 1.3) * k, (e1.y + n.y * 1.3) * k, (e1.z + n.z * 1.3) * k, _fr(T * 0.0004));
  if (u.uNe2) gl.uniform4f(u.uNe2, e2.x * k, e2.y * k, e2.z * k, B.polvo);
  if (u.uNb) gl.uniform4f(u.uNb, n.x, n.y, n.z, B.ancho);
  if (u.uNc1) gl.uniform4f(u.uNc1, B.c1[0], B.c1[1], B.c1[2], B.k);
  if (u.uNc2) gl.uniform3f(u.uNc2, B.c2[0], B.c2[1], B.c2[2]);
}
