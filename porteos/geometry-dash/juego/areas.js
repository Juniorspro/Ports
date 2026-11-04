// Triggers de área de la 2.2 (3006-3010 mover/girar/escalar/desvanecer/teñir, 3011-3015 sus
// ediciones, 3024 parar) y los de entrada (3017-3021, 3023). Cada efecto queda prendido y en cada
// cuadro le aplica a los objetos de su grupo un efecto que depende de la distancia al centro: lejos
// (pasado offset + largo) el efecto entero, cerca nada ("hacia adentro", 276, lo invierte). Las
// claves salen del esquema público de las propiedades; lo fino del juego se ajusta con el binario.
'use strict';
(() => {
const TR = GD.TR, H = TR.H;
const n = (v, d = 0) => v === undefined || v === '' ? d : +v;
const TIPO = { 3006: 'mover', 3007: 'girar', 3008: 'escalar', 3009: 'fade', 3010: 'tinte', 3017: 'mover', 3018: 'girar', 3019: 'escalar', 3020: 'fade', 3021: 'tinte' };
for (const id of [3006, 3007, 3008, 3009, 3010]) TR.def[id] = 'area';
for (const id of [3011, 3012, 3013, 3014, 3015]) TR.def[id] = 'areaEditar';
for (const id of [3017, 3018, 3019, 3020, 3021]) TR.def[id] = 'entrada22';
TR.def[3024] = 'areaParar'; TR.def[3023] = 'entradaParar';

// parámetros de un efecto a partir del trigger (también los usan las ediciones)
const leer = function (o, r) {
  const t = TIPO[o.id] || TIPO[o.id - 5];
  return {
    tipo: t, largo: n(r[222], 100), largoV: n(r[223]), off: n(r[220]), offV: n(r[221]), offY: n(r[252]), offYV: n(r[253]), frente: n(r[263], 1), atras: n(r[264], 1),
    muerta: n(r[282]), e: r[242] | 0, er: n(r[243], 2), salidaCurva: r[261] == 1, e2: r[248] | 0, er2: n(r[249], 2), dir: r[262] | 0, adentro: r[276] == 1, prio: r[341] | 0,
    // mover: distancia y ángulo, o x/y
    dist: n(r[218]), distV: n(r[219]), ang: n(r[231]), angV: n(r[232]), xy: r[241] == 1, mx: n(r[237]), mxV: n(r[238]), my: n(r[239]), myV: n(r[240]), relativo: r[287] == 1,
    giro: n(r[270]), giroV: n(r[271]), ex: n(r[233], 1), exV: n(r[234]), ey: n(r[235], 1), eyV: n(r[236]),
    opHasta: n(r[275], 0), opDesde: n(r[286], 1), tinte: n(r[265], 1), tCanal: r[260] | 0, hsvOn: r[278] == 1, hsv: r[49], soloBase: r[65] == 1, soloDetalle: r[66] == 1,
  };
};
const centroDe = r => ({ g: r[71] | 0, esp: n(r[538]) });
H.area = function (p, o, r) {
  const g = r[51] | 0; if (!g) return;
  const L = p.tr.areas = p.tr.areas || [];
  // el mismo trigger vuelto a activar reemplaza su efecto
  const i = L.findIndex(a => a.de === o.i); if (i >= 0) L.splice(i, 1);
  L.push(Object.assign(leer(o, r), { de: o.i, eid: n(r[225]), g, c: centroDe(r) }));
};
H.areaParar = function (p, o, r) { const id = r[51] | 0; if (p.tr.areas) p.tr.areas = p.tr.areas.filter(a => a.eid !== id); };
// edición: cambia los valores de los efectos con ese id (255) o de ese grupo, en el tiempo del trigger
H.areaEditar = function (p, o, r) {
  const L = p.tr.areas; if (!L) return;
  const id = r[51] | 0, porId = r[255] == 1, nuevo = leer(o, r);
  const campos = ['largo', 'off', 'offY', 'frente', 'atras', 'muerta', 'dist', 'ang', 'mx', 'my', 'giro', 'ex', 'ey', 'opHasta', 'tinte'];
  L.forEach((a, k) => {
    if (a.tipo !== nuevo.tipo || (porId ? a.eid !== id : a.g !== id)) return;
    TR.accion(p, { k: 'areaEd', idx: k, de: a.de, campos: campos.filter(c => r[CLAVE[c]] !== undefined).map(c => [c, a[c], nuevo[c]]), dur: n(r[10], 0), e: r[30] | 0, r: n(r[85], 2) });
  });
};
const CLAVE = { largo: 222, off: 220, offY: 252, frente: 263, atras: 264, muerta: 282, dist: 218, ang: 231, mx: 237, my: 239, giro: 270, ex: 233, ey: 235, opHasta: 275, tinte: 265 };
TR.pasoAreaEd = function (p, a, k) { const ar = (p.tr.areas || []).find(x => x.de === a.de); if (!ar) return; for (const [c, i, f] of a.campos) ar[c] = i + (f - i) * k; };
// entrada 2.2: lo mismo pero el "centro" son los bordes de la pantalla (217: 1 sólo entrar, 2 sólo salir)
H.entrada22 = function (p, o, r) {
  const L = p.tr.entradas = p.tr.entradas || [];
  const canal = n(r[344]), i = L.findIndex(a => a.tipo === (TIPO[o.id]) && a.canal === canal); if (i >= 0) L.splice(i, 1);
  L.push(Object.assign(leer(o, r), { de: o.i, canal, modo: r[217] | 0 }));
};
H.entradaParar = function (p, o, r) { const canal = n(r[344]); if (p.tr.entradas) p.tr.entradas = p.tr.entradas.filter(a => a.canal !== canal); };

// ---------- cálculo por cuadro ----------
// un número al azar fijo por objeto y efecto (para los ± de cada valor)
const az = (i, j, s) => { const x = Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233 + s * 37.719) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
const centro = function (p, a) {
  const c = a.c, D = GD.D, z = p.zoom || 1, W = D.ancho / z, Hh = D.alto / z, x0 = p.camX, y0 = p.camY;
  if (c.esp < 0) {
    const e = -c.esp;
    if (e === 1) return [p.j.x, p.j.y]; if (e === 2) return p.j2 ? [p.j2.x, p.j2.y] : [p.j.x, p.j.y]; if (e === 3) return [x0 + W / 2, y0 + Hh / 2];
    const cx = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 1, 1, 1][e - 1], cy = [0, 0, 0, 0, 0.5, 1, 0, 1, 0, 0.5, 1][e - 1];
    return [x0 + W * cx, y0 + Hh * cy];
  }
  if (c.g) return TR.centro(p, c.g);
  return [p.j.x, p.j.y];
};
const cuanto = function (a, d, o) {
  const largo = Math.max(0.0001, a.largo + a.largoV * az(o.i, a.de, 1)), off = a.off + a.offV * az(o.i, a.de, 2);
  let t = GD.clamp((d - off) / largo, 0, 1);
  if (a.muerta > 0) t = GD.clamp((t - a.muerta) / Math.max(0.0001, 1 - a.muerta), 0, 1);
  t = TR.curva(a.e, a.er)(t);
  return a.adentro ? 1 - t : t;
};
// junta lo de todos los efectos sobre cada objeto y lo aplica sacando lo del cuadro anterior
TR.pasoAreas = function (p) {
  const L = p.tr.areas, E = p.tr.entradas;
  const tocados = p._areaTocados || (p._areaTocados = new Set());
  const nuevos = new Map();
  const acumular = (o, a, k) => {
    if (k <= 0) return;
    let v = nuevos.get(o); if (!v) { v = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, op: 1, tinte: null }; nuevos.set(o, v); }
    if (a.tipo === 'mover') {
      let mx, my;
      if (a.xy) { mx = a.mx + a.mxV * az(o.i, a.de, 3); my = a.my + a.myV * az(o.i, a.de, 4); }
      else { const dist = a.dist + a.distV * az(o.i, a.de, 5), ang = (a.ang + a.angV * az(o.i, a.de, 6)) * Math.PI / 180; mx = Math.cos(ang) * dist; my = Math.sin(ang) * dist; }
      if (a.relativo && a._c) { const ang = Math.atan2(o.cy - (v.dy || 0) - a._c[1], o.cx - (v.dx || 0) - a._c[0]), l = Math.hypot(mx, my); mx = Math.cos(ang) * l; my = Math.sin(ang) * l; }
      v.dx += mx * k; v.dy += my * k;
    } else if (a.tipo === 'girar') v.rot += (a.giro + a.giroV * az(o.i, a.de, 7)) * k;
    else if (a.tipo === 'escalar') { v.sx *= 1 + ((a.ex + a.exV * az(o.i, a.de, 8)) - 1) * k; v.sy *= 1 + ((a.ey + a.eyV * az(o.i, a.de, 9)) - 1) * k; }
    else if (a.tipo === 'fade') v.op *= a.opDesde + (a.opHasta - a.opDesde) * k;
    else if (a.tipo === 'tinte') { const c = a.tCanal ? p.cols.valor(a.tCanal) : null; if (c) v.tinte = { rgb: [c.r, c.g, c.b], k: GD.clamp(a.tinte * k, 0, 1), hsv: a.hsvOn ? a.hsv : null, base: a.soloBase, det: a.soloDetalle }; }
  };
  if (L && L.length) for (const a of L) {
    const c = centro(p, a); if (!c) continue; a._c = c;
    for (const o of TR.grupo(p, a.g)) {
      const prev = o.aPrev, bx = o.cx - (prev ? prev.dx : 0), by = o.cy - (prev ? prev.dy : 0);
      const dx = bx - c[0], dy = by - c[1] - a.offY;
      const d = a.dir === 1 ? Math.abs(dx) : a.dir === 2 ? Math.abs(dy) : Math.hypot(dx, dy);
      const lado = (a.dir === 2 ? dy : dx) >= 0 ? a.frente : a.atras;
      acumular(o, a, cuanto(a, d, o) * lado);
    }
  }
  if (E && E.length) {
    const D = GD.D, z = p.zoom || 1, izq = p.camX, der = p.camX + D.ancho / z;
    for (const o of p._visibles || []) {
      if (o.raw[67] == 1 || o.raw[64] == 1) continue;
      for (const a of E) {
        if (a.canal && n(o.raw[343]) !== a.canal) continue;
        const prev = o.aPrev, bx = o.cx - (prev ? prev.dx : 0), dD = der - bx, dI = bx - izq;
        const entra = dD < dI;
        if ((a.modo === 1 && !entra) || (a.modo === 2 && entra)) continue;
        const d = Math.min(dD, dI);
        // en el borde (d = 0) el efecto entero, adentro de la pantalla se va apagando
        const largo = Math.max(0.0001, a.largo), t = 1 - GD.clamp((d - a.off) / largo, 0, 1);
        acumular(o, Object.assign({}, a, { de: a.de }), TR.curva(a.e, a.er)(t) * (entra ? a.frente : a.atras));
      }
    }
  }
  // aplicar: lo nuevo menos lo anterior (así conviven con los triggers de mover/girar/escalar)
  for (const o of tocados) if (!nuevos.has(o)) nuevos.set(o, null);
  tocados.clear();
  for (const [o, v] of nuevos) {
    const pv = o.aPrev || { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
    const nv = v || { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, op: 1, tinte: null };
    o.dx += nv.dx - pv.dx; o.dy += nv.dy - pv.dy; o.drot += nv.rot - pv.rot;
    o.esx = (o.esx || 1) * nv.sx / (pv.sx || 1); o.esy = (o.esy || 1) * nv.sy / (pv.sy || 1);
    o.opArea = nv.op; o.tinteArea = nv.tinte;
    if (v) { o.aPrev = { dx: nv.dx, dy: nv.dy, rot: nv.rot, sx: nv.sx, sy: nv.sy }; tocados.add(o); } else o.aPrev = null;
    if (nv.dx !== pv.dx || nv.dy !== pv.dy) p.moverSeccion(o);
  }
};
})();
