// ---------------- mapas del Workshop: el .bsp de Source leído en el navegador ----------------
// Un addon con maps/*.bsp suma sus mapas a la lista (WS_<nombre>). Al elegir uno se arma como los demás mapas (DATA.esc y
// DATA.aj, y cargarMapa hace el resto): las caras del mundo y de las entidades de bloques (puertas, paredes), los
// displacements (terrenos), por material y en pedazos de 64 m; los choques con esas mismas caras más las del cielo y las
// invisibles (en Source son paredes); el agua (se nada); los props estáticos y los prop_dynamic (con su .phy como cascos
// fijos) y los prop_physics (sueltos); las apariciones; el sol, la luz ambiente, la niebla y el color del cielo (de las
// seis caras de su caja). Materiales y texturas: los del addon, los empaquetados en el .bsp (pakfile) y los de HL2/GMod
// (biblioteca o Steam). Sin lightmaps: la luz es la del motor.
const GBSP = { mapas: new Map(), cache: new Map() };
const GBSP_CELDA = 64;   // (m: cada pedazo de mundo es una malla aparte, con su propia caja y precisión)
// (flags de texinfo de Source)
const SURF_SKY2D = 0x2, SURF_SKY = 0x4, SURF_WARP = 0x8, SURF_TRIGGER = 0x40, SURF_NODRAW = 0x80, SURF_HINT = 0x100, SURF_SKIP = 0x200;

const gbspClave = (ruta) => 'WS_' + ruta.replace(/^maps\//, '').replace(/\.bsp$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
// al montar un addon: sus mapas a la lista (con la foto que traiga en maps/thumb)
function gbspRegistrar(A) {
  for (const r of [...A.G.archivos.keys(), ...(A.G.perezosos ? A.G.perezosos.keys() : [])]) {
    const m = /^maps\/([^/]+)\.bsp$/.exec(r); if (!m) continue;
    const k = gbspClave(r); GBSP.mapas.set(k, { id: A.id, ruta: r, nombre: m[1], addon: A.nombre });
    if (!MAPAS_RB.includes(k)) MAPAS_RB.push(k);
    if (!MAPA_ICONO[k]) for (const f of ['maps/thumb/' + m[1] + '.png', 'maps/thumb/' + m[1] + '.jpg', 'maps/' + m[1] + '.png', 'maps/' + m[1] + '.jpg']) {
      const b = A.G.archivos.get(f); if (b) { MAPA_ICONO[k] = URL.createObjectURL(new Blob([b], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' })); break; }
    }
  }
}
function gbspQuitar(A) {
  for (const [k, x] of [...GBSP.mapas]) if (x.id === A.id) { GBSP.mapas.delete(k); const i = MAPAS_RB.indexOf(k); if (i >= 0) MAPAS_RB.splice(i, 1); delete DATA.esc[k]; delete DATA.aj[k]; }
}

// ---- el archivo ----
function gbspAbrir(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(0, true) !== 0x50534256) throw new Error('no es un .bsp');
  const ver = dv.getInt32(4, true);
  const lump = (i) => { const o = dv.getInt32(8 + i * 16, true), l = dv.getInt32(12 + i * 16, true); if (!(l > 0) || o < 0 || o + l > b.length) return new Uint8Array(0); return gbspLzma(b.subarray(o, o + l)); };
  return { b, dv, ver, lump, lver: (i) => dv.getInt32(16 + i * 16, true) };
}
// (un lump comprimido: "LZMA", tamaño real, tamaño comprimido, 5 bytes de propiedades: al formato "alone" del decodificador)
function gbspLzma(d) {
  if (!(d.length > 17 && d[0] === 0x4c && d[1] === 0x5a && d[2] === 0x4d && d[3] === 0x41)) return d;
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength), real = v.getUint32(4, true), comp = v.getUint32(8, true);
  const a = new Uint8Array(13 + comp); a.set(d.subarray(12, 17), 0); new DataView(a.buffer).setUint32(5, real, true); a.set(d.subarray(17, 17 + comp), 13);
  const o = GMF.lzma(a); return o.length > real ? o.subarray(0, real) : o;
}
const _gbTD = new TextDecoder('latin1');
const gbspCad = (u8, o) => { let e = o; while (e < u8.length && u8[e]) e++; return _gbTD.decode(u8.subarray(o, e)); };
function gbspEntidades(u8) {
  const s = _gbTD.decode(u8), out = [], re = /\{([^{}]*)\}/g; let m;
  while ((m = re.exec(s))) { const o = {}; for (const kv of m[1].matchAll(/"([^"]*)"\s+"([^"]*)"/g)) { const k = kv[1].toLowerCase(); if (o[k] === undefined) o[k] = kv[2]; else if (/^on[a-z]/.test(k)) o[k] = [].concat(o[k], kv[2]); } out.push(o); }
  return out;
}
// el zip que va adentro del .bsp (materiales, modelos y sonidos propios del mapa); los cubemaps no hacen falta
async function gbspPak(u8) {
  const out = new Map(); if (u8.length < 22) return out;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) return out;
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  for (let k = 0; k < n && p + 46 <= u8.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const met = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), us = dv.getUint32(p + 24, true), ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const nom = _gbTD.decode(u8.subarray(p + 46, p + 46 + ln)).toLowerCase().replace(/\\/g, '/'); p += 46 + ln + lx + lc;
    if (nom.endsWith('/') || /\/c-?\d+_-?\d+_-?\d+(\.hdr)?\.vtf$|cubemapdefault/.test(nom) || lo + 30 > u8.length || dv.getUint32(lo, true) !== 0x04034b50) continue;
    const ini = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), d = u8.subarray(ini, ini + cs);
    try { if (met === 0) out.set(nom, d.slice()); else if (met === 8) out.set(nom, await gpInflar(d, us)); } catch (er) {}
  }
  return out;
}
// lo que el mapa pide de la biblioteca de HL2/GMod (o de Steam): materiales, sus texturas y lo que incluyen, modelos
async function gbspTraer(rutas, prog) {
  if (typeof gmlTraer !== 'function') return;
  await Promise.all([typeof gmlIniciar === 'function' ? gmlIniciar() : null, typeof gbsIniciar === 'function' ? gbsIniciar() : null]);
  const tiene = (r) => typeof gmlTiene === 'function' && gmlTiene(r);
  const refs = (r, b, out) => {
    gmlRefs(r, b, out);
    if (r.endsWith('.vmt')) for (const m of _gbTD.decode(b).matchAll(/"?include"?\s+"([^"]+)"/gi)) { const v = m[1].toLowerCase().replace(/\\/g, '/'); if (tiene(v)) out.add(v); }
  };
  let pedir = new Set(rutas.filter(tiene));
  for (const r of rutas) { const b = GMOD.arch.get(r); if (b && /\.(vmt|mdl)$/.test(r)) refs(r, b, pedir); }
  for (let k = 0; k < 4 && pedir.size; k++) {
    const L = [...pedir].filter((r) => !GML.datos.has(r) && !GMOD.arch.has(r) && !(typeof GMPZ !== 'undefined' && GMPZ.idx.has(r))); if (!L.length) break;
    if (prog) prog(k, L.length); await gmlTraer(L); const nuevo = new Set();
    for (const r of L) { const b = GML.datos.get(r); if (b && /\.(vmt|mdl)$/.test(r)) refs(r, b, nuevo); }
    pedir = nuevo;
  }
}

// ---- de Source al juego ----
const gbspG = (x, y, z) => [y * GM_S, z * GM_S, x * GM_S];
function gbspQuatDe(f) {   // el giro que lleva (0, 0, 1) a la dirección f
  const z = v3(0, 0, 1), d = vdot(z, f);
  if (d > 0.9999) return new Quat(); if (d < -0.9999) return Quat.axis(0, 1, 0, Math.PI);
  const a = vcross(z, f).norm(); return Quat.axis(a.x, a.y, a.z, Math.acos(clamp(d, -1, 1)));
}
// una puerta de Source: func_door (se corre en "movedir"), func_door_rotating y prop_door_rotating (giran en su eje), en
// unidades del juego. Se abren con usar (E), o al tocarlas si el mapa lo pide; las que abre la lógica del mapa (botones,
// disparadores), también con usar: acá no corre la lógica de entradas y salidas de Source
function gbspPuertaDe(e, cl, o) {
  const dirG = (v) => { const g = [v[1], v[2], v[0]], l = Math.hypot(g[0], g[1], g[2]) || 1; return g.map((x) => x / l); };
  // (lo que gira —func_rotating: ventiladores, el disco de un tocadiscos—: va en su pieza como una puerta y lo mueve
  // mapaio.js con Start/Stop/Toggle/Reverse; lo que tiene pegado con "parentname" gira con él)
  if (cl === 'func_rotating') {
    const sf = +e.spawnflags || 0;
    return { cl, giro: true, rot: true, usa: false, silencio: true, vel: +e.maxspeed || 100, rev: !!(sf & 2), arranca: !!(sf & 1), pasa: !!(sf & 64),
      eje: dirG(sf & 4 ? [1, 0, 0] : sf & 8 ? [0, 1, 0] : [0, 0, 1]), ejeLocal: false, dist: 0, espera: -1, nombre: e.targetname || '', esclavo: '' };
  }
  if (!/^(func_door|func_door_rotating|func_movelinear|prop_door_rotating)$/.test(cl)) return null;
  const sf = +e.spawnflags || 0, giro = cl !== 'func_door' && cl !== 'func_movelinear';
  const P = { cl, giro, vel: +e.speed || 100, espera: e.wait !== undefined ? +e.wait : e.returndelay !== undefined ? +e.returndelay : cl === 'prop_door_rotating' ? -1 : 4,
    toca: cl === 'func_door' ? !!(sf & 1024) : false, usa: true, pasa: cl !== 'prop_door_rotating' && !!(sf & 8), nombre: e.targetname || '', esclavo: e.slavename || '', abierta: cl === 'prop_door_rotating' ? +e.spawnpos === 1 : !!(sf & 1), silencio: !!(sf & 4096), unaVia: !!(sf & 16) || +e.opendir === 1 || +e.opendir === 2, sentido: +e.opendir === 2 ? -1 : 1 };
  if (cl !== 'prop_door_rotating' && sf & 32) P.espera = -1;
  if (giro) {
    P.dist = Math.abs(+e.distance || 90) * (sf & 2 ? -1 : 1);
    // (el eje: arriba —Z de Source—, o X o Y según las banderas)
    P.eje = dirG(cl === 'prop_door_rotating' ? [0, 0, 1] : sf & 64 ? [1, 0, 0] : sf & 128 ? [0, 1, 0] : [0, 0, 1]);
    P.ejeLocal = cl === 'prop_door_rotating';   // (la de modelo gira en el eje de arriba del modelo)
  } else {
    const m = String(e.movedir || '0 0 0').split(/\s+/).map(Number), f = angMat(new LAng(m[0] || 0, m[1] || 0, m[2] || 0))[0];
    P.dir = dirG([f[0], f[1], f[2]]); P.lip = (+e.lip || 0) * GM_S; P.velM = P.vel * GM_S;
    if (cl === 'func_movelinear') { P.distM = (+e.movedistance || 100) * GM_S; P.toca = false; }
  }
  return P;
}
function gbspAngQ(s) { const v = String(s || '0 0 0').split(/\s+/).map(Number); return angQuat(new LAng(v[0] || 0, v[1] || 0, v[2] || 0)); }

// arma el mapa (DATA.esc / DATA.aj); prog(0..1, texto) para la pantalla de carga
async function gbspPreparar(clave, prog) {
  const info = GBSP.mapas.get(clave); if (!info) throw new Error('mapa no instalado');
  if (DATA.esc[clave]) return;
  const P0 = (p, t) => { try { prog && prog(p, t); } catch (e) {} };
  // (el .bsp de un addon guardado en el navegador se lee recién ahora, y después se suelta)
  let bytes = GMOD.arch.get(info.ruta);
  if (!bytes && typeof GMPZ !== 'undefined' && GMPZ.idx.has(info.ruta)) { P0(0.02, 'BSP'); bytes = await gmPzLeer(info.ruta); }
  if (!bytes) throw new Error('falta ' + info.ruta);
  P0(0.05, 'BSP');
  const B = gbspAbrir(bytes), L = (i) => B.lump(i);
  const ents = gbspEntidades(L(0));
  const pak = await gbspPak(L(40)); for (const [r, d] of pak) if (!GMOD.arch.has(r)) GMOD.arch.set(r, d);
  const pl = L(1), td = L(2), vt = L(3), ti = L(6), fc = L(7), ed = L(12), se = L(13), mo = L(14), di = L(26), dvs = L(33), sd = L(43), st = L(44);
  // el cielo 3D (sky_camera): una sala aparte con el paisaje de fondo en miniatura (1/scale). Su caja es la de las hojas
  // del árbol del BSP que están en la misma "área" que la cámara del cielo; lo que cae adentro (caras, props) no es parte
  // del mundo: no choca y se dibuja de fondo, agrandado, como en GMod (si no, se veía la maqueta debajo de las islas)
  const skc = ents.find((e) => e.classname === 'sky_camera' && e.origin);
  const apar0 = ents.filter((e) => /^info_player_|^gmod_player_start$/.test(e.classname || '') && e.origin).map((e) => e.origin.split(/\s+/).map(Number));
  let cc3 = null; if (skc && !Q.get('sinCielo3d')) { try { cc3 = gbspCajaCielo(B, skc.origin.split(/\s+/).map(Number), apar0); } catch (e) { cc3 = null; } }
  const enCielo = (q) => !!cc3 && q[0] >= cc3[0] && q[0] <= cc3[3] && q[1] >= cc3[1] && q[1] <= cc3[4] && q[2] >= cc3[2] && q[2] <= cc3[5];
  // la luz horneada (lightmaps): la de rango normal y, si el mapa sólo trae la HDR, ésa (mismo formato: RGB + exponente)
  let lit = L(8); if (!lit.length) lit = L(53);
  const conLM = lit.length > 0 && !Q.get('sinLM'), lmR = [], lmPor = new Map();
  // cada cara con luz: un rectángulo de luxels en el atlas (las que comparten datos, el mismo)
  const lmRect = (lo, w, h, bump) => { let r = lmPor.get(lo); if (r === undefined) { r = lmR.length; lmR.push({ lo, w, h, bump }); lmPor.set(lo, r); } return r; };
  const DV = (u) => new DataView(u.buffer, u.byteOffset, u.byteLength);
  const dPl = DV(pl), dTd = DV(td), dVt = DV(vt), dTi = DV(ti), dFc = DV(fc), dEd = DV(ed), dSe = DV(se), dMo = DV(mo), dDi = DV(di), dDvs = DV(dvs), dSt = DV(st);
  // los nombres de las texturas
  const nTd = (td.length / 32) | 0, texNom = [], texTam = [];
  for (let i = 0; i < nTd; i++) { const sid = dTd.getInt32(i * 32 + 12, true), off = sid * 4 + 4 <= st.length ? dSt.getInt32(sid * 4, true) : -1; texNom.push(off >= 0 ? gbspCad(sd, off).toLowerCase().replace(/\\/g, '/') : 'tools/toolsnodraw'); texTam.push([dTd.getInt32(i * 32 + 16, true) || 512, dTd.getInt32(i * 32 + 20, true) || 512]); }
  // los props (estáticos del game lump y los de entidades) y el cielo
  const props = gbspProps(B, ents);
  const ws = ents.find((e) => e.classname === 'worldspawn') || {}, cielo = String(ws.skyname || 'sky_day01_01').toLowerCase();
  const caras = ['up', 'dn', 'ft', 'bk', 'lf', 'rt'].map((c) => 'skybox/' + cielo + c);
  P0(0.15, 'materiales');
  // (cada vuelta —materiales, sus texturas, lo que incluyen— avanza la barra: con muchos archivos de Steam en un celular
  // tarda, y sin avances el vigilante de la carga creía que se había trabado)
  await gbspTraer([...new Set([...texNom.map((t) => 'materials/' + t + '.vmt'), ...texNom.map((t) => 'materials/' + t + '.vtf'), ...caras.map((t) => 'materials/' + t + '.vmt'), ...props.map((p) => p.modelo)])], (k, n) => P0(0.15 + 0.06 * k, 'materiales · ' + n));
  // (los props cuya geometría vino en un addon y quedó en el disco: se lee de a 6 y se arma su prefab ahí mismo, antes de
  // armar el mapa; si no, el armado —que no espera— los salteaba)
  if (typeof gmModeloFaltan === 'function') {
    const mods = [...new Set(props.map((p) => p.modelo))].filter((m) => /\.mdl$/.test(m) && !DATA.pfPorNombre['gm:' + m] && gmModeloFaltan(m).length);
    for (let i = 0; i < mods.length; i += 6) P0(0.4 + 0.14 * i / mods.length, 'modelos · ' + i + ' / ' + mods.length), await Promise.all(mods.slice(i, i + 6).map((m) => gmModeloPedir(m).then((ok) => { if (ok) { try { gmPrefab('gm:' + m); } catch (e) {} } })));
  }
  P0(0.55, 'geometría');
  // los materiales del mapa (el de cada textura, una vez)
  // (los materiales de agua de Source no traen textura base: van con el agua del motor, la que refleja y se ve de abajo)
  let aguaMi = -1; const aguaMat = () => { if (aguaMi < 0) { aguaMi = DATA.mt.findIndex((x) => x && x.n === 'GM_agua'); if (aguaMi < 0) { aguaMi = DATA.mt.length; DATA.mt.push({ n: 'GM_agua', t: gmTexBlanca(), ts: [1, 1], to: [0, 0], cc: { _Color: [0.22, 0.36, 0.42, 0.72] }, c: [0.22, 0.36, 0.42, 0.72], f: {}, gm: 1, sh: 'Legacy Shaders/Transparent/Diffuse' }); } } return { mi: aguaMi }; };
  const mats = new Map(), matDe = (i) => { let m = mats.get(i); if (m === undefined) { try { m = gmMaterial(texNom[i], ['']); if (m && m.vmt && /water/i.test(m.vmt.shader || '')) m = aguaMat(); } catch (e) { m = null; } mats.set(i, m); } return m; };
  const nVt = (vt.length / 12) | 0, vx = (i) => [dVt.getFloat32(i * 12, true), dVt.getFloat32(i * 12 + 4, true), dVt.getFloat32(i * 12 + 8, true)];
  // los pedazos: por celda de 64 m, por material (para dibujar) y aparte los triángulos de choque
  const ped = new Map(), pedC = new Map(), pedazo = (x, z, M) => { const k = Math.floor(x / GBSP_CELDA) + ':' + Math.floor(z / GBSP_CELDA); let p = M.get(k); if (!p) M.set(k, (p = { P: [], N: [], U: [], LM: [], por: new Map(), C: [] })); return p; };
  const agua = [];
  // una cara (polígono o grilla de displacement) ya en el juego: tris en índices locales
  // (lmv: de cada vértice, su rectángulo de luz y su luxel [r, s, t]; r -1 = la luz media del mapa, -2 = una que brilla)
  const ponerCara = (pts, nrm, uvs, tris, mi, dibuja, choca, esAgua, lmv, cielo) => {
    let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[2]; } const p = pzaPuerta || pedazo(cx / pts.length, cz / pts.length, cielo ? pedC : ped);
    if (dibuja && mi >= 0) {
      const base = p.P.length / 3; let L = p.por.get(mi); if (!L) p.por.set(mi, (L = []));
      for (let k = 0; k < pts.length; k++) { p.P.push(pts[k][0], pts[k][1], pts[k][2]); p.N.push(nrm[k][0], nrm[k][1], nrm[k][2]); p.U.push(uvs[k][0], uvs[k][1]); const l = lmv ? lmv[k] : null; p.LM.push(l ? l[0] : -1, l ? l[1] : 0, l ? l[2] : 0); }
      for (const t of tris) L.push(base + t[0], base + t[1], base + t[2]);
    }
    if (choca && !esAgua) for (const t of tris) for (const i of t) p.C.push(pts[i][0], pts[i][1], pts[i][2]);
  };
  // los modelos de bloques: el 0 es el mundo; los demás, de entidades (puertas, paredes), en su lugar
  const nMo = (mo.length / 48) | 0, usoMo = [{ i: 0, o: [0, 0, 0], q: null }];
  for (const e of ents) {
    const m = /^\*(\d+)$/.exec(e.model || ''); if (!m) continue; const cl = e.classname || '';
    if (/^(trigger_|func_areaportal|func_occluder|func_precipitation|func_buyzone|func_bomb_target|func_hostage_rescue|func_nobuild|func_ladderendpoint|func_dustcloud|func_smokevolume|env_|info_|func_viscluster|func_vehicleclip|func_respawnroom|func_nogrenades|func_regenerate|func_capturezone)/.test(cl)) continue;
    const o = String(e.origin || '0 0 0').split(/\s+/).map(Number), a = String(e.angles || '0 0 0').split(/\s+/).map(Number);
    // (como en Source: un func_brush desactivado al empezar no está; "Solidity" 1 nunca choca y 2 siempre; rendermode 10 o
    // renderamt 0 no se ve)
    // (las claves de las entidades quedan en minúsculas: con "Solidity" no se encontraba y las puertas de ascensor de los
    // Backrooms, que se atraviesan, eran paredes: se aparecía encerrado)
    if (/^func_(brush|wall_toggle)/.test(cl) && e.startdisabled === '1') continue;
    const noSolido = /^func_illusionary/.test(cl) || (/^func_brush/.test(cl) && e.solidity === '1'), invisible = /^func_clip/.test(cl) || e.rendermode === '10' || (e.rendermode && e.rendermode !== '0' && e.renderamt === '0');
    usoMo.push({ i: +m[1], o, rot: a.some((x) => x) ? angMat(new LAng(a[0] || 0, a[1] || 0, a[2] || 0)) : null, sinChoque: noSolido, sinDibujo: invisible, puerta: gbspPuertaDe(e, cl, o), nombre: String(e.targetname || '').toLowerCase(), padre: String(e.parentname || '').toLowerCase() });
  }
  // (las puertas de bloques van aparte, cada una en su pieza, para poder moverlas: puertas.js)
  let pzaPuerta = null;
  const ptaPorNombre = new Map();
  for (const U of usoMo) if (U.puerta) { U.pieza = { P: [], N: [], U: [], LM: [], por: new Map(), C: [] }; if (U.nombre && !ptaPorNombre.has(U.nombre)) ptaPorNombre.set(U.nombre, U); }
  for (const U of usoMo) if (!U.puerta && U.padre && ptaPorNombre.has(U.padre)) { const D = ptaPorNombre.get(U.padre); U.pieza = D.pieza; if (U.sinChoque) U.hijoSinChoque = true; }
  const nFc = (fc.length / 56) | 0, nDi = (di.length / 176) | 0;
  for (const U of usoMo) {
    if (U.i >= nMo) continue;
    pzaPuerta = U.pieza || null;
    const ff = dMo.getInt32(U.i * 48 + 40, true), nf = dMo.getInt32(U.i * 48 + 44, true);
    const tr = (p) => { if (!U.rot && !U.o[0] && !U.o[1] && !U.o[2]) return p; if (!U.rot) return [p[0] + U.o[0], p[1] + U.o[1], p[2] + U.o[2]]; const [f, l, u] = U.rot; return [U.o[0] + f[0] * p[0] + l[0] * p[1] + u[0] * p[2], U.o[1] + f[1] * p[0] + l[1] * p[1] + u[1] * p[2], U.o[2] + f[2] * p[0] + l[2] * p[1] + u[2] * p[2]]; };
    const trN = (n) => { if (!U.rot) return n; const [f, l, u] = U.rot; return [f[0] * n[0] + l[0] * n[1] + u[0] * n[2], f[1] * n[0] + l[1] * n[1] + u[1] * n[2], f[2] * n[0] + l[2] * n[1] + u[2] * n[2]]; };
    for (let f = ff; f < ff + nf && f < nFc; f++) {
      const o = f * 56, tix = dFc.getInt16(o + 10, true); if (tix < 0 || tix * 72 + 72 > ti.length) continue;
      const fl = dTi.getInt32(tix * 72 + 64, true), tdi = dTi.getInt32(tix * 72 + 68, true); if (fl & (SURF_TRIGGER | SURF_HINT | SURF_SKIP)) continue;
      const nom = texNom[tdi] || '', herramienta = nom.startsWith('tools/') && !/toolsblack/.test(nom), esAgua = (fl & SURF_WARP) || /(^|\/)(water|liquids?)[^/]*\/|water/.test(nom) && !/waterfall|underwater/.test(nom);
      const dibuja = !U.sinDibujo && !(fl & (SURF_SKY | SURF_SKY2D | SURF_NODRAW)) && !herramienta, choca = !U.sinChoque;
      if (!dibuja && !choca) continue;
      const pn = dFc.getUint16(o, true), side = fc[o + 2], fe = dFc.getInt32(o + 4, true), ne = dFc.getInt16(o + 8, true), dix = dFc.getInt16(o + 12, true);
      const poly = []; for (let k = 0; k < ne; k++) { const s = dSe.getInt32((fe + k) * 4, true), vi = s >= 0 ? dEd.getUint16(s * 4, true) : dEd.getUint16(-s * 4 + 2, true); if (vi < nVt) poly.push(vx(vi)); }
      if (poly.length < 3) continue;
      // (del cielo 3D: sólo se dibuja, de fondo)
      let esCielo = false;
      if (cc3) { let ex = 0, ey = 0, ez = 0; for (const q of poly) { ex += q[0]; ey += q[1]; ez += q[2]; } esCielo = enCielo(tr([ex / poly.length, ey / poly.length, ez / poly.length])); }
      if (esCielo && !dibuja) continue;
      const chocaC = choca && !esCielo;
      // hacia dónde mira la cara: en Source el plano de la cara ya es el suyo (side sólo dice si va al revés que el del
      // nodo) y lo que manda es la vuelta de los vértices (en sentido horario vista de frente); con el plano dado vuelta por
      // side, el techo y la mitad de las paredes de muchos mapas quedaban mirando para afuera y no se veían desde adentro
      let nS = [dPl.getFloat32(pn * 20, true), dPl.getFloat32(pn * 20 + 4, true), dPl.getFloat32(pn * 20 + 8, true)];
      { let wx = 0, wy = 0, wz = 0; for (let k = 0; k < poly.length; k++) { const a = poly[k], c = poly[(k + 1) % poly.length]; wx += (a[1] - c[1]) * (a[2] + c[2]); wy += (a[2] - c[2]) * (a[0] + c[0]); wz += (a[0] - c[0]) * (a[1] + c[1]); }
        const d = -(wx * nS[0] + wy * nS[1] + wz * nS[2]); if (d < 0) nS = nS.map((x) => -x); }
      nS = trN(nS);
      const tv = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => dTi.getFloat32(tix * 72 + k * 4, true)), [tw, th] = texTam[tdi] || [512, 512];
      const uvDe = (p) => [(tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2] + tv[3]) / tw, (tv[4] * p[0] + tv[5] * p[1] + tv[6] * p[2] + tv[7]) / th];
      const mat = dibuja ? matDe(tdi) : null, mi = mat ? mat.mi : -1, nG = gbspG(nS[0], nS[1], nS[2]).map((x) => x / GM_S);
      // la luz horneada de la cara: su rectángulo de luxels y dónde cae cada punto (con los lightmapVecs de su texinfo, en
      // el espacio del modelo, antes de moverlo a su lugar)
      let lmDe = null;
      if (conLM && dibuja) {
        const lo = dFc.getInt32(o + 20, true), sty = fc[o + 16], m0 = dFc.getInt32(o + 28, true), m1 = dFc.getInt32(o + 32, true), w = dFc.getInt32(o + 36, true) + 1, h = dFc.getInt32(o + 40, true) + 1;
        const lv = [8, 9, 10, 11, 12, 13, 14, 15].map((k) => dTi.getFloat32(tix * 72 + k * 4, true));
        if (lo >= 0 && sty !== 255 && !(fl & 0x400) && w > 0 && h > 0 && w <= 512 && h <= 512 && lo + w * h * 4 <= lit.length) {
          const r = lmRect(lo, w, h, !!(fl & 0x800));
          lmDe = (q) => [r, Math.max(0, Math.min(w - 1, lv[0] * q[0] + lv[1] * q[1] + lv[2] * q[2] + lv[3] - m0)), Math.max(0, Math.min(h - 1, lv[4] * q[0] + lv[5] * q[1] + lv[6] * q[2] + lv[7] - m1))];
        } else { const r = fl & 0x1 ? -2 : -1; lmDe = () => [r, 0, 0]; }
      }
      if (dix >= 0 && dix < nDi && poly.length === 4) {
        // displacement: la grilla sobre las 4 esquinas, desde la esquina más cerca de su punto de inicio
        const q = dix * 176, sp = [dDi.getFloat32(q, true), dDi.getFloat32(q + 4, true), dDi.getFloat32(q + 8, true)], v0 = dDi.getInt32(q + 12, true), pw = dDi.getInt32(q + 20, true), n = (1 << pw) + 1;
        let i0 = 0, dm = 1e18; poly.forEach((p, i) => { const d = (p[0] - sp[0]) ** 2 + (p[1] - sp[1]) ** 2 + (p[2] - sp[2]) ** 2; if (d < dm) { dm = d; i0 = i; } });
        const c = [0, 1, 2, 3].map((k) => poly[(i0 + k) % 4]), lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        const pts = [], uvs = [], lmv = [];
        for (let i = 0; i < n; i++) {
          const a = lerp(c[0], c[1], i / (n - 1)), b = lerp(c[3], c[2], i / (n - 1));
          for (let j = 0; j < n; j++) {
            const base = lerp(a, b, j / (n - 1)), w = (v0 + i * n + j) * 20; let pp = base;
            if (w + 20 <= dvs.length) { const d = dDvs.getFloat32(w + 12, true); pp = [base[0] + dDvs.getFloat32(w, true) * d, base[1] + dDvs.getFloat32(w + 4, true) * d, base[2] + dDvs.getFloat32(w + 8, true) * d]; }
            pts.push(gbspG(...tr(pp))); uvs.push(uvDe(base)); if (lmDe) lmv.push(lmDe(base));   // (la luz de la grilla, sobre la cara de base)
          }
        }
        const tris = [];
        for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < n; j++) { const a = i * n + j, b = (i + 1) * n + j, cc = (i + 1) * n + j + 1, d = i * n + j + 1; tris.push([a, b, cc], [a, cc, d]); }
        // (cada triángulo mirando para el lado de la cara de base) y las normales suaves de la grilla
        const nrm = pts.map(() => [0, 0, 0]);
        for (const t of tris) {
          const [a, b, cc] = t.map((k) => pts[k]), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = cc[0] - a[0], wy = cc[1] - a[1], wz = cc[2] - a[2];
          let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
          if (nx * nG[0] + ny * nG[1] + nz * nG[2] < 0) { const s = t[1]; t[1] = t[2]; t[2] = s; nx = -nx; ny = -ny; nz = -nz; }
          for (const k of t) { nrm[k][0] += nx; nrm[k][1] += ny; nrm[k][2] += nz; }
        }
        for (const v of nrm) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; }
        gbspUVcorr(uvs);
        ponerCara(pts, nrm, uvs, tris, mi, dibuja, chocaC, esAgua, lmDe ? lmv : null, esCielo);
        continue;
      }
      const pts = poly.map((p) => gbspG(...tr(p))), uvs = poly.map(uvDe), nrm = pts.map(() => nG), tris = [];
      for (let k = 1; k + 1 < pts.length; k++) {
        const t = [0, k, k + 1], a = pts[0], b = pts[k], cc = pts[k + 1];
        const nx = (b[1] - a[1]) * (cc[2] - a[2]) - (b[2] - a[2]) * (cc[1] - a[1]), ny = (b[2] - a[2]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[2] - a[2]), nz = (b[0] - a[0]) * (cc[1] - a[1]) - (b[1] - a[1]) * (cc[0] - a[0]);
        if (nx * nG[0] + ny * nG[1] + nz * nG[2] < 0) { t[1] = k + 1; t[2] = k; }
        tris.push(t);
      }
      gbspUVcorr(uvs);
      ponerCara(pts, nrm, uvs, tris, mi, dibuja, chocaC, esAgua, lmDe ? poly.map(lmDe) : null, esCielo);
      if (esAgua && dibuja && !esCielo && Math.abs(nG[1]) > 0.9) agua.push(pts);
    }
  }
  P0(0.75, 'props');
  // el atlas de la luz horneada (en los aparatos flojos, más chico: la luz se ve más suave pero ocupa menos)
  const lmA = conLM && lmR.length ? gbspAtlasLuz(lit, lmR, Math.min(4096, Math.max(1024, ((typeof GFX !== 'undefined' && GFX.texMax) || 1024) * 2))) : null;
  const lmUV = (p) => {
    if (!lmA) return null; const n = p.LM.length / 3, o = new Float32Array(n * 2), { W, H, f, pos } = lmA;
    for (let k = 0; k < n; k++) {
      const r = p.LM[k * 3]; if (r >= 0 && pos[r]) { o[k * 2] = (pos[r][0] + 1 + (p.LM[k * 3 + 1] + 0.5) / f) / W; o[k * 2 + 1] = (pos[r][1] + 1 + (p.LM[k * 3 + 2] + 0.5) / f) / H; }
      else { o[k * 2] = (r === -2 ? 6 : 2) / W; o[k * 2 + 1] = 2 / H; }   // (sin luz propia: la media del mapa, o una que brilla para los paneles de luz)
    }
    return o;
  };
  // el árbol del mapa: un nodo por pedazo (dibujo y choque), los props, las apariciones y el sol
  const arbs = [];
  for (const [k, p] of ped) {
    const nodo = { n: 'ws_' + k, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1 };
    if (p.por.size) { const ms = [...p.por.keys()]; nodo.m = gmMallaNueva('WS_' + clave + '_' + k, new Float32Array(p.P), new Float32Array(p.N), new Float32Array(p.U), ms.map((m) => p.por.get(m)), false, lmUV(p), clave); nodo.mt = ms; }
    if (p.C.length >= 9) { const n = p.C.length / 3, I = Array.from({ length: n }, (_, i) => i); nodo.col = [{ k: 'm', m: gmMallaNueva('WS_col_' + clave + '_' + k, new Float32Array(p.C), new Float32Array(n * 3), new Float32Array(n * 2), [I]), tr: 0 }]; }
    if (nodo.m !== undefined || nodo.col) arbs.push([nodo]);
  }
  pzaPuerta = null;
  let nPuerta = 0;
  const ptaArbs = [], ptaArbPorNombre = new Map();
  for (const U of usoMo) {
    const p = U.pieza; if (!p || !U.puerta) continue;
    // (la malla alrededor del eje de la puerta —el origen de la entidad—, para girarla o correrla desde ahí; y lo que mide,
    // en su espacio: la que se corre lo hace según eso, como en Source)
    const piv = gbspG(U.o[0], U.o[1], U.o[2]), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    const caja = (A) => { for (let k = 0; k + 2 < A.length; k += 3) for (let j = 0; j < 3; j++) { const v = A[k + j] - piv[j]; if (v < lo[j]) lo[j] = v; if (v > hi[j]) hi[j] = v; } };
    caja(p.P); caja(p.C);
    // (una puerta que choca con bloques invisibles —nodraw: el compilador les saca las caras—: su caja de choque es la del
    // modelo de bloques; los casilleros de HL2 son así, con el modelo que se ve pegado)
    if (p.C.length < 9 && !U.sinChoque && U.i > 0 && U.i < nMo) { const i = U.i * 48; for (let c = 0; c < 8; c++) { const g = gbspG(dMo.getFloat32(i + (c & 1 ? 12 : 0), true) + U.o[0], dMo.getFloat32(i + 4 + (c & 2 ? 12 : 0), true) + U.o[1], dMo.getFloat32(i + 8 + (c & 4 ? 12 : 0), true) + U.o[2]); p.C.push(g[0], g[1], g[2]); } caja(p.C); }
    for (let k = 0; k < p.P.length; k += 3) { p.P[k] -= piv[0]; p.P[k + 1] -= piv[1]; p.P[k + 2] -= piv[2]; }
    // (el casco de choque: hasta 300 puntos repartidos entre todos, no los primeros: si no, a una puerta grande le faltaba un lado)
    const casco = [], nC = p.C.length / 3, paso = Math.max(1, nC / 300); for (let q = 0; q < nC && casco.length < 900; q += paso) { const k = Math.floor(q) * 3; casco.push(+(p.C[k] - piv[0]).toFixed(3), +(p.C[k + 1] - piv[1]).toFixed(3), +(p.C[k + 2] - piv[2]).toFixed(3)); }
    const nodo = { n: 'gbsp_puerta_' + (nPuerta++), p: piv, r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1, puerta: Object.assign({}, U.puerta, { casco, solida: !U.sinChoque && !U.puerta.pasa, caja: lo[0] < 1e9 ? [lo, hi] : null }) };
    if (p.por.size) { const ms = [...p.por.keys()]; nodo.m = gmMallaNueva('WSP_' + clave + '_' + nodo.n, new Float32Array(p.P), new Float32Array(p.N), new Float32Array(p.U), ms.map((m) => p.por.get(m)), false, lmUV(p), clave); nodo.mt = ms; }
    const arb = [nodo]; ptaArbs.push(arb); if (U.nombre && !ptaArbPorNombre.has(U.nombre)) ptaArbPorNombre.set(U.nombre, arb);
  }
  const cielo3 = [];
  for (const [k, p] of pedC) {
    if (!p.por.size) continue; const ms = [...p.por.keys()];
    cielo3.push([{ n: 'wsc_' + k, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1, m: gmMallaNueva('WSC_' + clave + '_' + k, new Float32Array(p.P), new Float32Array(p.N), new Float32Array(p.U), ms.map((m) => p.por.get(m)), false, lmUV(p), clave), mt: ms }]);
  }
  const cascos = [], fisicos = [];
  for (const pr of props) {
    const nom = gmPrefab('gm:' + pr.modelo); if (!nom) continue;
    const pf = DATA.pf[DATA.pfPorNombre[nom]][0], pos = gbspG(...pr.o), q = gbspAngQ(pr.a);
    if (enCielo(pr.o)) { cielo3.push([{ n: nom, p: pos, r: [q.x, q.y, q.z, q.w], s: [1, 1, 1], pa: -1, m: pf.m, mt: pf.mt }]); continue; }   // (la maqueta del cielo 3D)
    if (pr.fisico) { fisicos.push({ nom, p: pos, q: [q.x, q.y, q.z, q.w] }); continue; }
    const arbP = pr.padre && !pr.puerta ? ptaArbPorNombre.get(pr.padre) : null;
    if (arbP) {
      // (en el espacio de la puerta: su eje es el origen y, si es de modelo, su giro)
      const R = arbP[0], q0 = new Quat(R.r[0], R.r[1], R.r[2], R.r[3]), qi = q0.clone().conj(), lp = qi.rot(v3(pos[0] - R.p[0], pos[1] - R.p[1], pos[2] - R.p[2])), lq = qi.clone().mul(q);
      arbP.push({ n: nom, p: [lp.x, lp.y, lp.z], r: [lq.x, lq.y, lq.z, lq.w], s: [1, 1, 1], pa: 0, m: pf.m, mt: pf.mt });
      if (pr.solido) { const C = R.puerta.casco, n0 = C.length; for (const c of pf.col || []) { const d = DATA.ms[c.m]; if (!d || !d.hp) continue; const n = d.hp.length / 3, paso = Math.max(1, n / 120); for (let t = 0; t < n && C.length < 1500; t += paso) { const k = Math.floor(t) * 3, v = lq.rot(v3(d.mn[0] + d.hp[k] / 65535 * d.sc[0], d.mn[1] + d.hp[k + 1] / 65535 * d.sc[1], d.mn[2] + d.hp[k + 2] / 65535 * d.sc[2])); C.push(+(v.x + lp.x).toFixed(3), +(v.y + lp.y).toFixed(3), +(v.z + lp.z).toFixed(3)); } }
        // (sin .phy: la caja de su malla)
        const dm = C.length === n0 && pf.m !== undefined && DATA.ms[pf.m]; if (dm && dm.mn) for (let i = 0; i < 8; i++) { const v = lq.rot(v3(dm.mn[0] + (i & 1 ? dm.sc[0] : 0), dm.mn[1] + (i & 2 ? dm.sc[1] : 0), dm.mn[2] + (i & 4 ? dm.sc[2] : 0))); C.push(+(v.x + lp.x).toFixed(3), +(v.y + lp.y).toFixed(3), +(v.z + lp.z).toFixed(3)); } }
      continue;
    }
    if (pr.puerta) {
      // (su choque: los cascos de su .phy en el espacio del modelo; puertas.js los gira con la puerta)
      const casco = []; for (const c of pf.col || []) { const d = DATA.ms[c.m]; if (!d || !d.hp) continue; for (let k = 0; k < d.hp.length && casco.length < 900; k += 3) casco.push(+(d.mn[0] + d.hp[k] / 65535 * d.sc[0]).toFixed(3), +(d.mn[1] + d.hp[k + 1] / 65535 * d.sc[1]).toFixed(3), +(d.mn[2] + d.hp[k + 2] / 65535 * d.sc[2]).toFixed(3)); }
      arbs.push([{ n: 'gbsp_puerta_p' + (nPuerta++), p: pos, r: [q.x, q.y, q.z, q.w], s: [1, 1, 1], pa: -1, m: pf.m, mt: pf.mt, puerta: Object.assign({}, pr.puerta, { casco, solida: true }) }]);
      continue;
    }
    const es = pr.esc || 1;
    arbs.push([{ n: nom, p: pos, r: [q.x, q.y, q.z, q.w], s: [es, es, es], pa: -1, m: pf.m, mt: pf.mt }]);
    if (!pr.solido) continue;
    // (choque: sus cascos del .phy, ya puestos en su lugar)
    for (const c of pf.col || []) { const d = DATA.ms[c.m]; if (!d || !d.hp) continue; const pts = []; for (let k = 0; k < d.hp.length; k += 3) { const v = q.rot(v3(d.mn[0] + d.hp[k] / 65535 * d.sc[0], d.mn[1] + d.hp[k + 1] / 65535 * d.sc[1], d.mn[2] + d.hp[k + 2] / 65535 * d.sc[2])); pts.push(v.x + pos[0], v.y + pos[1], v.z + pos[2]); } if (pts.length >= 12) cascos.push(pts); }
  }
  for (const arb of ptaArbs) if (arb[0].m !== undefined || arb.length > 1) { if (!arb[0].puerta.caja && arb.length > 1) arb[0].puerta.solida = arb[0].puerta.solida && arb[0].puerta.casco.length >= 12; arbs.push(arb); }
  // los botones y las zonas (trigger_*) que abren o cierran puertas por nombre, como sus salidas en Source
  // ("blanco,Open,,0,-1"): el botón se usa con E y la zona se activa al entrar o salir de ella
  const ptaNom = new Set(usoMo.filter((U) => U.puerta && U.nombre).map((U) => U.nombre)); for (const pr of props) if (pr.puerta && pr.puerta.nombre) ptaNom.add(pr.puerta.nombre.toLowerCase());
  // (las salidas enteras: [destino, entrada, valor, demora, veces]; mapaio.js las cumple con lo que sabe hacer)
  const salidas = (e, re) => { const o = []; for (const k in e) { if (!re.test(k)) continue; for (const v of [].concat(e[k])) { const s = String(v).split(/[,\x1b]/), t = (s[0] || '').toLowerCase().trim(), i = (s[1] || '').toLowerCase().trim(); if (t && i) o.push([t, i, String(s[2] || ''), +s[3] || 0, s[4] !== undefined && s[4] !== '' ? +s[4] : -1]); } } return o; };
  const cajaMo = (e) => { const m = /^\*(\d+)$/.exec(e.model || ''); if (!m || +m[1] >= nMo) return null; const i = +m[1] * 48, o = String(e.origin || '0 0 0').split(/\s+/).map(Number), a = gbspG(dMo.getFloat32(i, true) + o[0], dMo.getFloat32(i + 4, true) + o[1], dMo.getFloat32(i + 8, true) + o[2]), b = gbspG(dMo.getFloat32(i + 12, true) + o[0], dMo.getFloat32(i + 16, true) + o[1], dMo.getFloat32(i + 20, true) + o[2]); return [[0, 1, 2].map((k) => Math.min(a[k], b[k])), [0, 1, 2].map((k) => Math.max(a[k], b[k]))]; };
  const ptaBot = [], ptaZona = [];
  for (const e of ents) {
    const cl = e.classname || '';
    if (/^(func_button|func_rot_button)$/.test(cl)) {
      // (OnPressed siempre; los de dos posiciones —bandera 32— alternan OnIn y OnOut, como el tocadiscos del Liminal Hotel)
      const sal = { p: salidas(e, /^onpressed$/i), i: salidas(e, /^onin$/i), o: salidas(e, /^onout$/i), l: salidas(e, /^onuselocked$/i) }, n = sal.p.length + sal.i.length + sal.o.length;
      const c = n && cajaMo(e); if (c) ptaBot.push({ c, sal, tog: (+e.spawnflags || 0) & 32 ? 1 : 0, bloq: (+e.spawnflags || 0) & 2048 ? 1 : 0, n: String(e.targetname || '').toLowerCase() });
    }
    else if (/^trigger_(multiple|once)$/.test(cl)) { const en = salidas(e, /^on(starttouch|trigger|starttouchall)$/i), sa = salidas(e, /^on(endtouch|endtouchall)$/i), c = (en.length || sa.length) && cajaMo(e); if (c) ptaZona.push({ c, en, sa, una: cl === 'trigger_once', n: String(e.targetname || '').toLowerCase(), off: e.startdisabled === '1' }); }
  }
  // los sonidos del mapa (ambient_generic), los relevos (logic_relay) y lo que pasa al cargar (logic_auto): mapaio.js
  const io = { snd: [], relay: [], auto: [] };
  for (const e of ents) {
    const cl = e.classname || '';
    if (cl === 'ambient_generic' && e.message && e.origin && io.snd.length < 200) {
      const sf = +e.spawnflags || 0, o = String(e.origin).split(/\s+/).map(Number);
      io.snd.push({ n: String(e.targetname || '').toLowerCase(), s: String(e.message), v: Math.max(0, Math.min(10, e.health !== undefined && e.health !== '' ? +e.health : 10)) / 10, r: Math.max(64, +e.radius || 1250) * GM_S,
        p: gbspG(o[0], o[1], o[2]), todo: !!(sf & 1), ini: !(sf & 16), bucle: !(sf & 32), tono: Math.max(30, Math.min(250, +e.pitch || 100)) / 100 });
    } else if (cl === 'logic_relay' && e.targetname) io.relay.push({ n: String(e.targetname).toLowerCase(), sal: salidas(e, /^ontrigger$/i), on: e.startdisabled !== '1' });
    else if (cl === 'logic_auto') io.auto.push(...salidas(e, /^on(mapspawn|newgame)$/i));
  }
  // apariciones (las de GMod, HL2DM, CS:S, TF2...)
  const sp = ents.filter((e) => /^info_player_(start|deathmatch|combine|rebel|terrorist|counterterrorist|teamspawn)$|^gmod_player_start$|^info_spawnpoint$/.test(e.classname || '') && e.origin);
  // (mirando hacia donde mira la aparición, como en GMod: el giro de Source es el mismo ángulo en el juego)
  for (const e of sp.slice(0, 64)) { const o = e.origin.split(/\s+/).map(Number), a = String(e.angles || '0 0 0').split(/\s+/).map(Number); arbs.push([{ n: 'SpawnPoint', p: gbspG(o[0], o[1], o[2] + 16), r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1, yaw: ((a[1] || 0) * Math.PI) / 180 }]); }
  // el sol y la luz ambiente (light_environment)
  const le = ents.find((e) => e.classname === 'light_environment'), aj = { lejos: 0, gbsp: 1 };
  if (le) {
    const a = String(le.angles || '0 0 0').split(/\s+/).map(Number), pit = le.pitch !== undefined ? +le.pitch : a[0], f = angMat(new LAng(pit || -45, a[1] || 0, 0))[0], fG = dG({ x: f[0], y: f[1], z: f[2] }).norm(), q = gbspQuatDe(fG);
    const lz = String(le._light || '255 255 255 200').split(/\s+/).map(Number), am = String(le._ambient || '').split(/\s+/).map(Number);
    arbs.push([{ n: 'Sol', p: [0, 0, 0], r: [q.x, q.y, q.z, q.w], s: [1, 1, 1], pa: -1, lz: { t: 1, c: [lz[0] / 255, lz[1] / 255, lz[2] / 255], i: Math.pow(clamp((lz[3] || 200) / 220, 0.4, 1.6), 1 / 2.2) } }]);   // (el brillo de Source es lineal: el color del sol se pasa a lineal y después se lo multiplica; acá el color y el brillo se pasan juntos —(c·i)^2,2—, así que el brillo va con su raíz y no queda elevado a 2,2: un sol de 1,6 daba 2,8 veces y los props se veían quemados y naranjas)
    if (am.length >= 3 && am.every(Number.isFinite)) { const k = clamp((am[3] || 20) / 60, 0.25, 1.2), c = [am[0], am[1], am[2]].map((x) => clamp(x / 255 * k + 0.12, 0.08, 0.9)); aj.ambRB = [c.map((x) => x), c.map((x) => x * 0.75)]; }
  }
  // la luz horneada para el dibujo; y si el mapa no tiene sol (un interior), la luz de relleno de los personajes y props
  // sale de la media de lo horneado y no hay sombras del sol (el techo las taparía todas)
  if (lmA) {
    aj.lm = { w: lmA.W, h: lmA.H, px: lmA.px };
    if (!le) { const c = lmA.medio.map((x) => clamp(Math.pow(x, 1 / 2.2) * 0.85, 0.12, 0.85)); aj.ambRB = [c, c.map((x) => x * 0.8)]; aj.sinSombra = 1; }
  }
  // la niebla (env_fog_controller)
  const fo = ents.find((e) => e.classname === 'env_fog_controller' && e.fogenable !== '0');
  if (fo && +fo.fogend > +fo.fogstart) { const c = String(fo.fogcolor || '200 200 200').split(/\s+/).map((x) => +x / 255); aj.fog = 1; aj.fm = 1; aj.fs = +fo.fogstart * GM_S; aj.fe = +fo.fogend * GM_S; aj.fc = [c[0], c[1], c[2], 1]; aj.fmax = fo.fogmaxdensity !== undefined && Number.isFinite(+fo.fogmaxdensity) ? clamp(+fo.fogmaxdensity, 0, 1) : 1; }
  // las puertas portal (linked_portal_door, del addon World Portals): el centro, hacia dónde mira (adelante, derecha y
  // arriba, ya en el juego) y la mitad del ancho y del alto; cada una con el nombre de su compañera
  const pds = ents.filter((e) => e.classname === 'linked_portal_door' && e.origin && e.targetname && e.partnername && e.startactive !== '0');
  if (pds.length) aj.portales = pds.slice(0, 64).map((e) => {
    const o = e.origin.split(/\s+/).map(Number), a = String(e.angles || '0 0 0').split(/\s+/).map(Number), [f, l, u] = angMat(new LAng(a[0] || 0, a[1] || 0, a[2] || 0)), g = (v) => [v[1], v[2], v[0]], L = g(l);
    return { n: e.targetname, par: e.partnername, o: gbspG(o[0], o[1], o[2]), f: g(f), r: [-L[0], -L[1], -L[2]], u: g(u), w: (+e.width || 64) * GM_S, h: (+e.height || 64) * GM_S };
  }).filter((d) => d.o.every(Number.isFinite) && d.w > 0 && d.h > 0);
  // el cielo 3D: dónde está su cámara (en el juego), cuánto se agranda, su niebla y hasta dónde llega su sala
  if (cc3 && cielo3.length) {
    const o = skc.origin.split(/\s+/).map(Number), sc = Math.max(1, +skc.scale || 16), fc = String(skc.fogcolor || '255 255 255').split(/\s+/).map((x) => clamp((+x || 0) / 255, 0, 1));
    aj.cielo3d = { o: gbspG(o[0], o[1], o[2]), s: sc, arbs: cielo3, lejos: Math.hypot(cc3[3] - cc3[0], cc3[4] - cc3[1], cc3[5] - cc3[2]) * GM_S * 1.2 + 10,
      fog: skc.fogenable === '1' && +skc.fogend > +skc.fogstart ? { c: fc, a: (+skc.fogstart || 0) * GM_S / sc, b: (+skc.fogend || 1) * GM_S / sc, m: skc.fogmaxdensity !== undefined && Number.isFinite(+skc.fogmaxdensity) ? clamp(+skc.fogmaxdensity, 0, 1) : 1 } : null };
  }
  // el cielo 2D de verdad: sus seis caras pasadas a un cubo (en los aparatos flojos, más chico)
  // (el «painted» de GMod —el celeste de gm_construct— se arma acá sin bajar nada; si el de un mapa no se puede traer —sin el
  // contenido base—, también: el cielo de siempre de GMod antes que el degradé del juego)
  if (cielo !== 'painted') try { const Lc = (typeof GFX !== 'undefined' && GFX.texMax && GFX.texMax <= 256) ? 256 : 512; await gbspCieloTraer(cielo, Lc); const cub = gbspCieloCubo(cielo, Lc); if (cub) aj.cieloCubo = cub; } catch (e) {}
  if (!aj.cieloCubo) aj.cieloCubo = cieloPainted(64);
  // el color del cielo: el promedio de las caras de su caja (arriba, el horizonte y abajo)
  const media = (r) => { try { const b = gmArchivo('materials/' + r + '.vmt'), v = b ? GMF.vmt(b, (p) => gmArchivo('materials/' + p.replace(/\.vmt$/, '') + '.vmt')) : null, tb = v && v.base ? gmVtfYa('materials/' + v.base + '.vtf', 16) : gmVtfYa('materials/' + r + '.vtf', 16); if (!tb) return null; const t = GMF.vtf(tb, 16), px = GMF.vtfRGBA(t), s = [0, 0, 0]; for (let i = 0; i < px.length; i += 4) { s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; } const n = px.length / 4; return s.map((x) => x / n / 255); } catch (e) { return null; } };
  let up = media(caras[0]), dn = media(caras[1]), lados = [2, 3, 4, 5].map((i) => media(caras[i])).filter(Boolean);
  let mid = lados.length ? [0, 1, 2].map((k) => lados.reduce((a, x) => a + x[k], 0) / lados.length) : null;
  if (cielo === 'painted' || (!up && !mid && aj.cieloCubo === cieloPainted(64))) { const P = CIELO_PAINTED; up = P[0].map((x) => x / 255); mid = P[16].map((x) => x / 255); dn = up; }
  if (up || mid) { aj.sky = DATA.mt.length; DATA.mt.push({ n: 'GMA_cielo_' + clave, t: -1, gm: 1, sh: 'Skybox/Procedural', cc: { _TopColor: (up || mid).concat(1), _MiddleColor: (mid || up).concat(1), _BottomColor: (dn || mid || up).concat(1), _SunTint: [1, 0.95, 0.85, 1] }, f: { _TopExponent: 0.8, _BottomExponent: 1 } }); }
  // hasta dónde se ve: lo que mide el mapa (con tope)
  let lo = [1e9, 1e9], hi = [-1e9, -1e9]; for (const [k] of ped) { const [x, z] = k.split(':').map(Number); lo = [Math.min(lo[0], x), Math.min(lo[1], z)]; hi = [Math.max(hi[0], x + 1), Math.max(hi[1], z + 1)]; }
  if (lo[0] < 1e9) aj.lejos = clamp(Math.hypot(hi[0] - lo[0], hi[1] - lo[1]) * GBSP_CELDA, 120, 1600);
  aj.cascos = cascos; aj.fisicos = fisicos;
  // el agua: un volumen bajo cada superficie de agua (se nada), en el formato de agua.js; el fondo, el punto más bajo de
  // lo que choca debajo de esa superficie
  aj.agua = agua.slice(0, 64).map((pts) => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y = 0; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); y += p[1]; } y /= pts.length;
    let yb = 1e9; for (const p of ped.values()) { const C = p.C; for (let k = 0; k < C.length; k += 3) if (C[k] >= x0 && C[k] <= x1 && C[k + 2] >= z0 && C[k + 2] <= z1 && C[k + 1] < y - 0.05 && C[k + 1] < yb) yb = C[k + 1]; }
    return { lo: [x0, yb < 1e8 ? yb : y - 4, z0], hi: [x1, y, z1] };
  });
  if (!sp.length) { const c = arbs.find((a) => a[0].col); if (c) { const d = DATA.ms[c[0].col[0].m]; arbs.push([{ n: 'SpawnPoint', p: [d.mn[0] + d.sc[0] / 2, d.mn[1] + d.sc[1] + 2, d.mn[2] + d.sc[2] / 2], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1 }]); } }
  if (ptaBot.length) aj.ptaBot = ptaBot.slice(0, 300); if (ptaZona.length) aj.ptaZona = ptaZona.slice(0, 300);
  if (io.snd.length || io.relay.length || io.auto.length) aj.io = io;
  DATA.esc[clave] = arbs; DATA.aj[clave] = aj;
  P0(1, 'listo');
}
// la caja (en Source) de la sala del cielo 3D: las hojas del árbol del BSP del "área" donde está la cámara del cielo. Si
// esa área tiene una aparición o es la mitad del mapa (no hay sala aparte), no hay cielo 3D
function gbspCajaCielo(B, o, apar) {
  const pl = B.lump(1), nd = B.lump(5), hj = B.lump(10); if (!pl.length || !nd.length || !hj.length) return null;
  const dP = new DataView(pl.buffer, pl.byteOffset, pl.byteLength), dN = new DataView(nd.buffer, nd.byteOffset, nd.byteLength), dH = new DataView(hj.buffer, hj.byteOffset, hj.byteLength);
  const HS = B.lver(10) === 0 ? 56 : 32, nH = (hj.length / HS) | 0, nN = (nd.length / 32) | 0, nP = (pl.length / 20) | 0;
  let n = 0, k = 0;
  while (n >= 0) {
    if (n >= nN || k++ > 4096) return null;
    const pi = dN.getInt32(n * 32, true); if (pi < 0 || pi >= nP) return null;
    const d = dP.getFloat32(pi * 20, true) * o[0] + dP.getFloat32(pi * 20 + 4, true) * o[1] + dP.getFloat32(pi * 20 + 8, true) * o[2] - dP.getFloat32(pi * 20 + 12, true);
    n = dN.getInt32(n * 32 + (d >= 0 ? 4 : 8), true);
  }
  const h = -1 - n; if (!(h >= 0 && h < nH) || (dH.getInt32(h * HS, true) & 1)) return null;
  const area = (i) => dH.getInt16(i * HS + 6, true) & 0x1ff, A = area(h), c = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  let nA = 0, nTot = 0;
  for (let i = 0; i < nH; i++) {
    if (dH.getInt32(i * HS, true) & 1) continue; nTot++;
    if (area(i) !== A) continue; nA++;
    for (let j = 0; j < 3; j++) { c[j] = Math.min(c[j], dH.getInt16(i * HS + 8 + j * 2, true)); c[3 + j] = Math.max(c[3 + j], dH.getInt16(i * HS + 14 + j * 2, true)); }
  }
  // (si la cámara del cielo cae en el área del mapa, su caja tiene a los puntos de aparición adentro y no vale; sin puntos de
  // aparición para mirar, el área del cielo no puede ser casi todo el mapa. No alcanzaba con el tamaño: gm_construct 13 tiene
  // un cielo 3D tan detallado que su área es el 61 % de las hojas, no se reconocía y la ciudad del fondo no se veía)
  if (!nA || (!(apar && apar.length) && nA > nTot * 0.4)) return null;
  for (const q of apar || []) if (q[0] >= c[0] && q[0] <= c[3] && q[1] >= c[1] && q[1] <= c[4] && q[2] >= c[2] && q[2] <= c[5]) return null;
  return c;
}
// las seis caras del cielo 2D de Source (rt +X, lf -X, bk +Y, ft -Y, up +Z, dn -Z) pasadas a las caras del cubo de WebGL
// (como herramientas/gmod.py: el mismo reparto, medido sin costuras); la cara que falte (casi siempre la de abajo), del
// color medio de las otras
const GB_CUBO = [[[1, 0, 0], [0, 0, -1], [0, -1, 0]], [[-1, 0, 0], [0, 0, 1], [0, -1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, -1]], [[0, 0, 1], [1, 0, 0], [0, -1, 0]], [[0, 0, -1], [-1, 0, 0], [0, -1, 0]]];
// (las caras del cielo que estén en un addon guardado en el navegador: se leen antes, hasta el tamaño del cubo)
async function gbspCieloTraer(nombre, L) {
  if (typeof GMPZ === 'undefined') return;
  const rr = [];
  for (const suf of ['rt', 'bk', 'lf', 'ft', 'up', 'dn']) {
    let base = 'skybox/' + nombre + suf;
    try { const vb = gmArchivo('materials/skybox/' + nombre + suf + '.vmt'), v = vb ? GMF.vmt(vb, (q) => gmArchivo('materials/' + q.replace(/\.vmt$/, '') + '.vmt')) : null; if (v && v.base) base = v.base; } catch (e) {}
    rr.push('materials/' + base + '.vtf', 'materials/skybox/' + nombre + suf + '.vtf');
  }
  await Promise.all([...new Set(rr)].filter((r) => GMPZ.idx.has(r)).map((r) => gmPzVtf(r, L)));
}
function gbspCieloCubo(nombre, L) {
  const C = {}; let suma = [0, 0, 0], ns = 0;
  for (const suf of ['rt', 'bk', 'lf', 'ft', 'up', 'dn']) {
    try {
      const vb = gmArchivo('materials/skybox/' + nombre + suf + '.vmt'), v = vb ? GMF.vmt(vb, (q) => gmArchivo('materials/' + q.replace(/\.vmt$/, '') + '.vmt')) : null;
      const tb = (v && v.base && gmVtfYa('materials/' + v.base + '.vtf', L)) || gmVtfYa('materials/skybox/' + nombre + suf + '.vtf', L); if (!tb) continue;
      const t = GMF.vtf(tb, L), px = GMF.vtfRGBA(t); C[suf] = { w: t.w, h: t.h, px };
      if (suf !== 'up' && suf !== 'dn') for (let i = 0; i < px.length; i += 16) { suma[0] += px[i]; suma[1] += px[i + 1]; suma[2] += px[i + 2]; ns++; }
    } catch (e) {}
  }
  if (!C.rt && !C.lf && !C.bk && !C.ft) return null;
  const medio = suma.map((x) => (ns ? x / ns : 128) | 0);
  const leer = (suf, s, t, out, o) => {
    const im = C[suf]; if (!im) { out[o] = medio[0]; out[o + 1] = medio[1]; out[o + 2] = medio[2]; return; }
    const { w, h, px } = im, fil = suf !== 'up' && suf !== 'dn' && h * 2 === w ? (1 - t) * h - 0.5 : (1 - t) / 2 * h - 0.5, col = (s + 1) / 2 * w - 0.5;
    const x0 = Math.floor(col), y0 = Math.floor(fil), fx = col - x0, fy = fil - y0, X0 = Math.min(w - 1, Math.max(0, x0)), Y0 = Math.min(h - 1, Math.max(0, y0)), X1 = Math.min(w - 1, X0 + 1), Y1 = Math.min(h - 1, Math.max(0, y0 + 1));
    for (let c = 0; c < 3; c++) out[o + c] = (px[(Y0 * w + X0) * 4 + c] * (1 - fx) * (1 - fy) + px[(Y0 * w + X1) * 4 + c] * fx * (1 - fy) + px[(Y1 * w + X0) * 4 + c] * (1 - fx) * fy + px[(Y1 * w + X1) * 4 + c] * fx * fy) | 0;
  };
  const caras = [];
  for (const [f, r, a] of GB_CUBO) {
    const out = new Uint8Array(L * L * 3);
    for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
      const u = (i + 0.5) / L * 2 - 1, v = (j + 0.5) / L * 2 - 1;
      // (del juego a Source: x = z del juego, y = x, z = y)
      const x = f[2] + u * r[2] + v * a[2], y = f[0] + u * r[0] + v * a[0], z = f[1] + u * r[1] + v * a[1], ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z), o = (j * L + i) * 3;
      if (ax >= ay && ax >= az) { if (x > 0) leer('rt', -y / ax, z / ax, out, o); else leer('lf', y / ax, z / ax, out, o); }
      else if (ay >= az) { if (y > 0) leer('bk', x / ay, z / ay, out, o); else leer('ft', -x / ay, z / ay, out, o); }
      else if (z > 0) leer('up', -y / az, -x / az, out, o); else leer('dn', -x / az, y / az, out, o);
    }
    caras.push(out);
  }
  return { L, caras };
}
// el atlas de la luz horneada: cada rectángulo de luxels (RGB + exponente, ColorRGBExp32) en su lugar, con un borde
// repetido para que el filtrado no traiga luz de la cara vecina; arriba a la izquierda, dos bloques de 4×4: la luz media
// del mapa (caras sin luz propia) y una que brilla (paneles de luz). Se guarda en gamma hasta 4 veces el blanco. Si no
// entra en el tope, cada cara a la mitad (y así).
function gbspAtlasLuz(lit, R, tope) {
  const dv = new DataView(lit.buffer, lit.byteOffset, lit.byteLength), lin = (o) => { const e = dv.getInt8(o + 3), k = Math.pow(2, e) / 255; return [lit[o] * k, lit[o + 1] * k, lit[o + 2] * k]; };
  const enc = (x) => Math.round(Math.pow(Math.min(Math.max(x, 0) / 4, 1), 1 / 2.2) * 255);
  for (let f = 1; f <= 8; f *= 2) {
    const S = R.map((r) => [Math.ceil(r.w / f) + 2, Math.ceil(r.h / f) + 2]);
    let area = 64; for (const [w, h] of S) area += w * h;
    let W = 64; while (W * W < area * 1.2 && W < tope) W *= 2;
    const ord = S.map((_, i) => i).sort((a, b) => S[b][1] - S[a][1] || S[b][0] - S[a][0]), pos = new Array(R.length);
    let x = 8, y = 0, sh = 4, cabe = true;
    for (const i of ord) { const [w, h] = S[i]; if (w > W) { cabe = false; break; } if (x + w > W) { y += sh; x = 0; sh = 0; } pos[i] = [x, y]; x += w; if (h > sh) sh = h; }
    let H = 4; while (H < y + sh) H *= 2;
    if (!cabe || H > tope) continue;
    const px = new Uint8Array(W * H * 4), suma = [0, 0, 0]; let cuenta = 0;
    const pon = (X, Y, c) => { const o = (Y * W + X) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; };
    for (let i = 0; i < R.length; i++) {
      const r = R[i], [x0, y0] = pos[i], ww = S[i][0] - 2, hh = S[i][1] - 2;
      for (let b = 0; b < hh; b++) for (let a = 0; a < ww; a++) {
        const c = [0, 0, 0]; let n = 0;
        for (let yy = b * f; yy < Math.min(r.h, b * f + f); yy++) for (let xx = a * f; xx < Math.min(r.w, a * f + f); xx++) { const l = lin(r.lo + (yy * r.w + xx) * 4); c[0] += l[0]; c[1] += l[1]; c[2] += l[2]; n++; }
        if (n) { c[0] /= n; c[1] /= n; c[2] /= n; suma[0] += c[0]; suma[1] += c[1]; suma[2] += c[2]; cuenta++; }
        pon(x0 + 1 + a, y0 + 1 + b, [enc(c[0]), enc(c[1]), enc(c[2])]);
      }
      // (el borde: copia de la orilla de adentro, también en las esquinas)
      for (let b = -1; b <= hh; b++) for (let a = -1; a <= ww; a++) {
        if (a >= 0 && a < ww && b >= 0 && b < hh) continue;
        const sa = Math.min(ww - 1, Math.max(0, a)), sb = Math.min(hh - 1, Math.max(0, b)), so = ((y0 + 1 + sb) * W + x0 + 1 + sa) * 4, d = ((y0 + 1 + b) * W + x0 + 1 + a) * 4;
        px[d] = px[so]; px[d + 1] = px[so + 1]; px[d + 2] = px[so + 2]; px[d + 3] = 255;
      }
    }
    const medio = cuenta ? suma.map((x) => x / cuenta) : [0.5, 0.5, 0.5];
    for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) { pon(a, b, medio.map(enc)); pon(4 + a, b, [enc(1.25), enc(1.25), enc(1.25)]); }
    return { W, H, f, pos, px, medio };
  }
  return null;
}
// las UV de una cara llevadas cerca de 0 por un entero (se repiten igual y no pierden precisión en el medio float del
// vértice). Las caras que repiten la textura muchas veces, por el entero de su CENTRO: |u| queda en la mitad y el medio
// float es el doble de preciso (en un mapa tipo Minecraft, con caras de cientos de bloques, la textura ya no se corre en
// los bordes); las que la usan una sola vez —pueden ir con la textura sin repetir—, por el de su mínimo, como siempre
function gbspUVcorr(uvs) {
  let mu = 1e9, mv = 1e9, Mu = -1e9, Mv = -1e9;
  for (const u of uvs) { if (u[0] < mu) mu = u[0]; if (u[0] > Mu) Mu = u[0]; if (u[1] < mv) mv = u[1]; if (u[1] > Mv) Mv = u[1]; }
  const ancha = Mu - mu > 2 || Mv - mv > 2, du = Math.floor(ancha ? (mu + Mu) / 2 : mu), dv = Math.floor(ancha ? (mv + Mv) / 2 : mv);
  for (const u of uvs) { u[0] -= du; u[1] = 1 - (u[1] - dv); }
}
// los props del mapa: los estáticos (game lump "sprp") y los de entidades (prop_dynamic fijos, prop_physics sueltos)
function gbspProps(B, ents) {
  const out = [], gl = B.lump(35);
  try {
    const dv = new DataView(gl.buffer, gl.byteOffset, gl.byteLength), n = dv.getInt32(0, true);
    for (let i = 0; i < n && 4 + i * 16 + 16 <= gl.length; i++) {
      const o = 4 + i * 16; if (dv.getUint32(o, true) !== 0x73707270) continue;   // 'sprp'
      const fo = dv.getInt32(o + 8, true), fl = dv.getInt32(o + 12, true); if (fo < 0 || fo + fl > B.b.length) continue;
      let d = gbspLzma(B.b.subarray(fo, fo + fl)); const v = new DataView(d.buffer, d.byteOffset, d.byteLength); let p = 0;
      const nd = v.getInt32(p, true); p += 4; const dic = []; for (let k = 0; k < nd; k++) { dic.push(gbspCad(d, p).toLowerCase().replace(/\\/g, '/')); p += 128; }
      const nl = v.getInt32(p, true); p += 4 + nl * 2;
      const np = v.getInt32(p, true); p += 4; if (!(np > 0)) break;
      const paso = Math.floor((d.length - p) / np); if (paso < 32) break;
      // (desde la versión 11 del lump —mapas de GMod nuevos— cada prop puede tener su escala: la última cosa del registro)
      const ver = dv.getUint16(o + 6, true), conEscala = ver >= 11 && paso >= 80;
      for (let k = 0; k < np; k++, p += paso) {
        const ti = v.getUint16(p + 24, true), sol = d[p + 30];
        if (!dic[ti]) continue;
        const esc = conEscala ? v.getFloat32(p + paso - 4, true) : 1;
        out.push({ modelo: dic[ti], o: [v.getFloat32(p, true), v.getFloat32(p + 4, true), v.getFloat32(p + 8, true)], a: v.getFloat32(p + 12, true) + ' ' + v.getFloat32(p + 16, true) + ' ' + v.getFloat32(p + 20, true), solido: sol !== 0, esc: esc > 0.01 && esc < 100 ? esc : 1 });
      }
    }
  } catch (e) { gmErr && gmErr('props del mapa', e); }
  for (const e of ents) {
    if (!/^prop_(dynamic|dynamic_override|physics|physics_multiplayer|physics_override|static|door_rotating)$/.test(e.classname || '') || !/\.mdl$/i.test(e.model || '') || !e.origin) continue;
    const puerta = e.classname === 'prop_door_rotating' ? gbspPuertaDe(e, e.classname, e.origin.split(/\s+/).map(Number)) : null;
    out.push({ modelo: e.model.toLowerCase().replace(/\\/g, '/'), o: e.origin.split(/\s+/).map(Number), a: e.angles || '0 0 0', solido: e.solid !== '0', fisico: /^prop_physics/.test(e.classname), puerta, padre: String(e.parentname || '').toLowerCase() });
  }
  return out.slice(0, 4000);
}
// después de cargarMapa: los cascos de los props y los props sueltos del mapa (el agua la pone cargarMapa)
function gbspTrasCargar(clave) {
  const aj = DATA.aj[clave]; if (!aj || !aj.gbsp) return;
  for (const pts of aj.cascos || []) {
    const L = []; for (let k = 0; k < pts.length; k += 3) L.push(v3(pts[k], pts[k + 1], pts[k + 2]));
    try { const h = hullDePuntos(L), b = new Body(h.shape, 0); b.pos.copy(h.c); b.updateWorld(); b.estatico = true; MUNDO.cajas.push(b); const a = b.aabb; grillaAgregar(a.x0, a.z0, a.x1, a.z1, b); } catch (e) {}
  }
  for (const f of (aj.fisicos || []).slice(0, 300)) { try { crearObjeto(f.nom, v3(f.p[0], f.p[1], f.p[2]), new Quat(f.q[0], f.q[1], f.q[2], f.q[3])); } catch (e) {} }
}
