// ---------------- muñecos de trapo de cualquier modelo de GMod (el prop_ragdoll de verdad, no sólo los humanos) ----------------
// Bugs y sugerencias: «que cuando descargue un modelo de GMod se pone duro» (dvq7d92i, con video), «que haga ragdolls»
// (za7gix4d) y «sección de ragdolls» (582w89z5). Los modelos con esqueleto humano de Valve ya caían como muñeco (gmragModelo:
// llevados al esqueleto del personaje del juego); los demás —animales, criaturas, robots, personajes con su propio
// esqueleto— se ponían como un prop duro, en pose T. Ahora, como en GMod: si el .phy trae dos o más sólidos (uno por hueso),
// cada sólido es un cuerpo con su casco convexo, unidos con las restricciones del .phy («ragdollconstraint»: hasta cuánto
// dobla y gira cada unión) o, si no trae, por la jerarquía de huesos. Cada cuadro los huesos salen de los cuerpos y el modelo
// se dibuja con su piel (gmanHuesos → gmrgHuesos). Se agarra con la Physics Gun y la Gravity Gun, los tiros y las
// explosiones lo empujan, se borra con el tacho, y los huesos sin sólido siguen a su padre.
const GMRG = { lista: new Set() };
const _rgM = new Float32Array(16), _rgN = new Float32Array(16);

function gmrgPhy(ruta) { const b = gmArchivo(String(ruta).replace(/\.mdl$/i, '.phy')); if (!b) return null; try { return GMF.phy(b); } catch (e) { return null; } }
// ¿se puede hacer muñeco? (el modelo con su piel animable y un .phy con 2 o más sólidos que nombran huesos de él)
function gmrgPuede(ruta) {
  if (typeof gmanDef !== 'function') return false;
  const d = gmanDef(ruta); if (!d || d.virt || !d.gp) return false;
  const F = gmrgPhy(ruta); if (!F || F.solidos.length < 2) return false;
  let n = 0; F.hueso.forEach((h, s) => { if (h && d.porNombre.has(h) && F.solidos[s] && F.solidos[s].length) n++; });
  return n >= 2;
}
// las restricciones del .phy: ragdollconstraint { "parent" "0" "child" "1" "xmin" "-30" "xmax" "30" … }
function gmrgRestricciones(texto) {
  const out = [];
  for (const m of String(texto || '').matchAll(/ragdollconstraint\s*\{([^}]*)\}/gi)) {
    const g = (k) => { const r = new RegExp('"' + k + '"\\s+"(-?[\\d.]+)"', 'i').exec(m[1]); return r ? +r[1] : 0; };
    out.push({ pa: g('parent'), hi: g('child'), xmin: g('xmin'), xmax: g('xmax'), ymin: g('ymin'), ymax: g('ymax'), zmin: g('zmin'), zmax: g('zmax') });
  }
  return out;
}
function gmrgMasas(texto) { const m = []; for (const x of String(texto || '').matchAll(/solid\s*\{([^}]*)\}/gi)) { const ix = /"index"\s+"(\d+)"/i.exec(x[1]), ma = /"mass"\s+"([\d.]+)"/i.exec(x[1]); if (ix) m[+ix[1]] = ma ? +ma[1] : 0; } return m; }

// arma el muñeco de la entidad e (con e.modelo y su lugar): los cuerpos en la pose de ahora
function gmrgArmar(e) {
  const ruta = gmanRuta(e.modelo), d = gmanDef(ruta), F = gmrgPhy(ruta); if (!d || !F) return false;
  const H = gmanHuesos(e); if (!H) return false;
  const W0 = H.W, S = GM_S, masas = gmrgMasas(F.texto), cuerpos = [], porHueso = new Map();
  // (el peso: el del .phy, pero con un total de al menos 45 kg y 2 kg por pieza. Con piezas de 1 kg —el Funtime Foxy trae
  // casi todas así— las uniones las sacudían sin parar: seguían girando a 6-19 vueltas por segundo después de caer)
  const tot = masas.reduce((a, m) => a + (m || 0), 0), kMasa = tot > 0 && tot < 45 ? 45 / tot : 1;
  F.solidos.forEach((piezas, s) => {
    const nb = F.hueso[s], k = nb ? d.porNombre.get(nb) : undefined;
    if (k === undefined || !piezas || !piezas.length || porHueso.has(k)) { cuerpos[s] = null; return; }
    const W = W0[1 + k], sc = m4esc(W) || 1, pts = [];
    // (los puntos del sólido están en el espacio de su hueso, en pulgadas y con los ejes de Source: x, y, z → y, z, x)
    for (const f of piezas) for (let i = 0; i + 2 < f.length; i += 3) if (Number.isFinite(f[i] + f[i + 1] + f[i + 2]) && Math.abs(f[i]) + Math.abs(f[i + 1]) + Math.abs(f[i + 2]) < 6000) pts.push(v3(f[i + 1] * S * sc, f[i + 2] * S * sc, f[i] * S * sc));
    if (pts.length < 4) { cuerpos[s] = null; return; }
    const hd = hullDePuntos(pts), q = m4quat(W).norm(), o = v3(W[12], W[13], W[14]);
    const b = new Body(hd.shape, clamp((masas[s] || 4) * kMasa, 2, 400), { fric: 0.9, rest: 0.02, damp: 0.15, angDamp: 0.92 });
    b.pos.copy(vadd(o, q.rot(hd.c.clone()))); b.q.copy(q);
    b.group = 3000 + (e.id | 0); b.noCruza = true; b.gmRag = e; b.noJug = false;
    // (inercia mínima, la de una bola de 8 cm de radio con su peso: las puntas finas —dedos, pies, colas— tienen casi nada y
    // cualquier corrección de la unión las hacía girar sin parar)
    { const iMax = 1 / (0.4 * b.mass * 0.08 * 0.08); b.invI.set(Math.min(b.invI.x, iMax), Math.min(b.invI.y, iMax), Math.min(b.invI.z, iMax)); }
    addBody(b);
    m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _rgM);
    const c = { b, k, s, off: m4mul(M4.inv(_rgM), W, new Float32Array(16)) };
    cuerpos[s] = c; porHueso.set(k, c);
  });
  const vivos = cuerpos.filter(Boolean); if (vivos.length < 2) { for (const c of vivos) removeBody(c.b); return false; }
  // las uniones: las del .phy; las que falten, con el antepasado más cercano que tenga cuerpo
  const hijos = new Set(), unir = (A, B, lim) => {
    if (!A || !B || A === B) return;
    const Wb = W0[1 + B.k], Wa = W0[1 + A.k], pt = v3(Wb[12], Wb[13], Wb[14]);
    let ax = vsub(pt, v3(Wa[12], Wa[13], Wa[14])); if (ax.len() < 1e-4) ax = v3(0, 1, 0);
    const g = (x) => Math.abs(x) * Math.PI / 180;
    // (las de pocos grados —o 0, trabadas— se abren un poco: la referencia de los límites acá es la pose en que se armó, no la
    // del muñeco de Source, y una unión casi rígida entre piezas livianas vibra)
    const swing = lim ? clamp(Math.max(g(lim.ymin), g(lim.ymax), g(lim.zmin), g(lim.zmax)), 0.35, 1.6) : 0.7;
    const twist = lim ? clamp(Math.max(g(lim.xmin), g(lim.xmax)), 0.25, 1.2) : 0.4;
    addJoint(A.b, B.b, pt, ax.norm(), { swing, twist }); hijos.add(B);
  };
  for (const r of gmrgRestricciones(F.texto)) unir(cuerpos[r.pa], cuerpos[r.hi], r);
  for (const c of vivos) {
    if (hijos.has(c)) continue;
    let p = d.padres[c.k]; while (p >= 0 && !porHueso.has(p)) p = d.padres[p];
    if (p >= 0) unir(porHueso.get(p), c, null);
  }
  // los huesos sin cuerpo: su giro relativo al padre en esta pose (siguen al padre); la raíz del modelo, relativa al primer cuerpo
  const L = Array.from({ length: d.nb }, (_, i) => { const p = d.padres[i]; return m4mul(M4.inv(p >= 0 ? W0[1 + p] : W0[0]), W0[1 + i], new Float32Array(16)); });
  const raiz = vivos[0], R0 = m4mul(M4.inv(W0[1 + raiz.k]), W0[0], new Float32Array(16));
  e.ragGen = { cuerpos: vivos, porHueso, L, raiz, R0 };
  GMRG.lista.add(e);
  return true;
}
// los huesos, de los cuerpos (lo llama gmanHuesos para una entidad con ragGen)
function gmrgHuesos(e, d) {
  const G = e.ragGen; let H = e._anH;
  if (!H || H.def !== d) H = e._anH = { def: d, W: Array.from({ length: d.nb + 1 }, () => new Float32Array(16)), serie: 0 };
  if (H.cuadroRG === GMAN.cuadro) return H; H.cuadroRG = GMAN.cuadro; H.serie = ++GMAN.serie;
  const W = H.W, cuerpo = (c, out) => { const b = c.b; m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _rgM); return m4mul(_rgM, c.off, out); };
  cuerpo(G.raiz, _rgN); m4mul(_rgN, G.R0, W[0]);
  for (let i = 0; i < d.nb; i++) {
    const c = G.porHueso.get(i);
    if (c) cuerpo(c, W[1 + i]);
    else { const p = d.padres[i]; m4mul(p >= 0 ? W[1 + p] : W[0], G.L[i], W[1 + i]); }
  }
  return H;
}
// poner uno desde el menú: adelante, donde apunta la mira, mirando al jugador; cae y queda tirado
function gmrgModelo(ruta) {
  if (!gmArchivo(ruta)) { if (typeof gmlPedir === 'function') gmlPedir(ruta); return null; }
  if (!gmrgPuede(ruta)) return null;
  // (un addon de sólo modelos no arranca el Lua de GMod, y sin él no se dibujan sus entidades: se arranca, como con los
  // nextbots de los demás —gmod_nextbot.js—)
  if (!GMA.R) gmaIniciar(); if (!GMA.activo) GMA.activo = true; if (!GMA.R) return null;
  const p = gmMiraPunto(2.5), e = new LEnt('prop_ragdoll', 'ent');
  e.creado = true; e.cs = true; e.modelo = ruta; e.creador = GMA.jug;
  e.pos = v3(p.x, p.y + 0.35, p.z); e.q = Quat.axis(0, 1, 0, Math.atan2(JUG.pos.x - p.x, JUG.pos.z - p.z));
  GMA.ents.delete(e.id); GMA.ents.set(e.id, e);
  // (la pose de referencia del modelo, un poco arriba del piso: cae y se acomoda)
  if (!gmrgArmar(e)) { e.vivo = false; GMA.ents.delete(e.id); return null; }
  for (const c of e.ragGen.cuerpos) c.b.vel.set(0, -0.5, 0);
  return e;
}
function gmrgQuitar(e) {
  const G = e && e.ragGen; if (!G) return;
  for (const c of G.cuerpos) { try { removeBody(c.b); } catch (x) {} }
  e.ragGen = null; e.vivo = false; GMA.ents.delete(e.id); GMRG.lista.delete(e);
}
// cada cuadro: la entidad va donde su primer cuerpo (para el Lua, la red y lo que la busca por lugar); los que se borraron
// (el tacho, el Lua, cambiar de mapa) sueltan sus cuerpos
function gmrgPaso() {
  for (const e of GMRG.lista) {
    if (!e.ragGen) { GMRG.lista.delete(e); continue; }
    if (e.vivo === false || !GMA.ents.has(e.id)) { gmrgQuitar(e); continue; }
    const b = e.ragGen.raiz.b; if (e.pos && e.pos.copy) e.pos.copy(b.pos);
  }
}
if (typeof module !== 'undefined') module.exports = { GMRG, gmrgPuede, gmrgArmar, gmrgHuesos, gmrgModelo, gmrgQuitar, gmrgPaso, gmrgRestricciones };
