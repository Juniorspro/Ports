// ---------------- sonidos de los personajes y del ambiente (los de Half-Life 2, de GMod 10) ----------------
// Pasos según el piso (cada triángulo del mapa sabe de qué es: pasto, tierra, arena, metal, madera, baldosa, piedra u
// hormigón; parado sobre un prop, el del prop), al ritmo del paso (más largos corriendo) y fuertes al caer. Voces: dolor y
// muerte según el personaje (hombre, mujer, robot o monstruo) y algunas en los emotes (saludo, festejo, no, grito).
// Ambiente por mapa: viento y pájaros en el campo (ranas y bichos de noche), viento fuerte en el desierto, la ciudad,
// el zumbido de adentro y de la estación; más bajo bajo techo.
const SND = { ambT: 3 };
const SUP = ['concrete', 'grass', 'dirt', 'sand', 'metal', 'wood', 'tile', 'gravel'];
const SUP_RE = [[1, /grass|pasto|c[eé]sped|hierba|lawn|turf|follaje|leaf/i], [3, /sand|arena|desert|desierto|beach|playa|dune/i], [2, /dirt|mud|tierra|soil|ground|barro|terreno/i],
  [4, /metal|steel|iron|chapa|grate|alumin|container|contenedor|vent/i], [5, /wood|madera|plank|parquet|crate|tabla/i], [6, /tile|baldosa|ceramic|marble|m[aá]rmol|azulejo/i], [7, /gravel|grava|rock|roca|stone|piedra|pebble|cliff/i]];
// de qué es un material (su $surfaceprop si es de GMod; si no, por su nombre y el de su textura): el número de SUP
function sonSupDeMat(mi) {
  const d = DATA.mt[mi]; if (!d) return 0;
  if (d.sp !== undefined) return d.sp;   // (los de GMod: su $surfaceprop de Source, lo mismo que usa HL2)
  const s = (d.n || '') + ' ' + (d.t !== undefined && DATA.tx[d.t] ? DATA.tx[d.t].n || '' : '');
  for (const [k, re] of SUP_RE) if (re.test(s)) return k;
  return 0;
}
// el piso bajo los pies: el triángulo del mapa o el cuerpo donde está parado
function sonPiso(pos, conCuerpos) {
  const o = v3(pos.x, pos.y - 0.6, pos.z), d = v3(0, -1, 0);
  const h = conCuerpos ? raycast(o, d, 1.2, null) : mundoRayo(o, d, 1.2);
  if (!h) return 0;
  const b = h.body || h.caja || (h.stat && h.stat.caja); if (b) return b.sup !== undefined ? b.sup : b.snd === 'metal' ? 4 : b.snd === 'concrete' ? 0 : 5;
  const tri = h.stat ? h.stat.tri : h.tri;
  return tri !== undefined && tri >= 0 && MUNDO.triSup && tri < MUNDO.triSup.length ? MUNDO.triSup[tri] : 0;
}
function sonPaso(P, yo, pos, vol) {
  const k = sonPiso(pos, yo), n = 'PS_' + SUP[k] + (1 + ((Math.random() * 4) | 0));
  sonar(n, yo ? null : v3(pos.x, pos.y - 0.9, pos.z), vol * (yo ? 0.4 : 0.75), 0.94 + Math.random() * 0.12);
}
function sonPasos(dt) {
  for (const P of PERS) {
    const yo = P === JUG.cuerpo;
    if (P.rag || P.flota || P.sentado || P.cuad || P.visible === false) { P.pasoD = 0; P.pasoAire = 0; continue; }
    const pos = yo ? JUG.pos : P.pos, vel = yo ? JUG.vel : P.vel;
    if (!yo && pos.distTo(CAM.pos) > 30) continue;
    const agua = yo ? JUG.nada || (JUG.hondo || 0) > 0.25 : !!aguaNadaPersona(P);   // (en el agua suenan los pasos del agua: agua.js)
    const suelo = !agua && (yo ? JUG.suelo && !JUG.vehiculo && !JUG.noclip && JUG.vivo : P.suelo);
    // al caer: un paso fuerte (más cuanto más rápido venía)
    if (suelo && (P.pasoAire || 0) > 0.3 && (P.pasoVy || 0) < -3) { sonPaso(P, yo, pos, Math.min(1, 0.35 - (P.pasoVy || 0) / 14)); P.pasoD = 0; }
    if (!suelo) { P.pasoAire = (P.pasoAire || 0) + dt; P.pasoVy = vel.y; continue; }
    P.pasoAire = 0;
    const sp = Math.hypot(vel.x, vel.z); if (sp < 0.4) { P.pasoD = Math.min(P.pasoD || 0, 0.4); continue; }
    const L = Math.min(1.6, 0.72 + 0.17 * Math.max(0, sp - 1.4)) * (P.tam || 1);   // (el paso se alarga con la velocidad: 0,72 m caminando, 1,5 m a 6 m/s)
    P.pasoD = (P.pasoD || 0) + sp * dt;
    if (P.pasoD >= L) { P.pasoD -= L; sonPaso(P, yo, pos, clamp(sp / 6, 0.35, 0.8) * ((yo ? ENT.agachar : P.agachado) ? 0.45 : 1)); }
  }
}
// ---------------- voces ----------------
const VOZ_CLASE = { SpecialForcesW: 'm', PilotFemale: 'm', Bombera: 'm', Robot: 'r', Freddy: 'r', Bonnie: 'r', Chica: 'r', Foxy: 'r', Zombi: 'z', Corpse: 'z', BoiledOne: 'z', Sunman: 'z', Filbus: 'z' };
const VOZ_N = { dolor: 9, ay: 2, hola: 2, bien: 2, no: 2, ayuda: 1, ok: 1 };
const VOZ_OTRO = { z: { dolor: 6, muere: 3 }, r: { dolor: 2, muere: 1 } };
function sonVoz(P, tipo, pos) {
  if (!P) return;
  const c = VOZ_CLASE[P.skin] || 'h', N = VOZ_OTRO[c] || VOZ_N;
  if (TIEMPO.t - (P.vozT === undefined ? -9 : P.vozT) < (tipo === 'muere' ? 0 : 0.45)) return;
  let n;
  if (tipo === 'muere' && !VOZ_OTRO[c]) n = 'VZ_' + c + '_dolor' + (7 + ((Math.random() * 3) | 0));   // (las más largas)
  else if (N[tipo]) n = 'VZ_' + c + '_' + tipo + (1 + ((Math.random() * N[tipo]) | 0));
  else return;
  P.vozT = TIEMPO.t;
  sonar(n, P === JUG.cuerpo ? null : pos || P.pos, P === JUG.cuerpo ? 0.6 : 0.9, c === 'z' || c === 'r' ? 0.95 + Math.random() * 0.1 : 0.97 + Math.random() * 0.06);
}
const VOZ_EMOTE = { Hi: 'hola', Victory: 'bien', Disagree: 'no', Scream: 'ayuda', 'rb:Saludo': 'hola' };
function sonEmote(P, e) { const t = VOZ_EMOTE[e]; if (t) sonVoz(P, t); }
// ---------------- ambiente ----------------
const AMB = {
  campo: { loop: 'AM_viento1', v: 0.16 }, desierto: { loop: 'AM_viento2', v: 0.32 }, ciudad: { loop: 'AM_ciudad', v: 0.3 },
  interior: { loop: 'AM_interior', v: 0.22, adentro: true }, espacio: { loop: 'AM_lab', v: 0.12, adentro: true }, luna: { loop: 'AM_tono', v: 0.25, adentro: true },
};
function sonAmbTipo(m) {
  if (!m || m === 'RB_Pizzeria') return null;   // (la pizzería tiene los suyos)
  if (/desert|desierto|mars/i.test(m)) return 'desierto';
  if (/^(City|RB_Ciudad)$/.test(m)) return 'ciudad';
  if (/^Base/.test(m)) return 'interior';
  if (m === 'Space') return 'espacio';
  if (m === 'RB_Luna') return 'luna';
  return 'campo';
}
function sonAmbiente(dt) {
  if (JUEGO.estado !== 'juego' || AGUA.bajo || NOC.on || PREFS.ambiente === false) return;
  const tipo = sonAmbTipo(MUNDO.nombre); if (!tipo) return;
  const A = AMB[tipo], noche = DIA.hora < 6 || DIA.hora > 20, k = A.adentro ? 1 : 1 - 0.7 * (AUD.adentro || 0);   // (bajo techo, el de afuera más bajo)
  bucle('amb', A.loop, CAM.pos, A.v * k);
  if (tipo === 'campo' && noche) bucle('ambN', 'AM_ranas', CAM.pos, 0.16 * k);
  // sueltos, cada 4 a 14 s, entre 15 y 40 m alrededor: pájaros de día, bichos de noche, ráfagas, un camión que pasa
  SND.ambT -= dt; if (SND.ambT > 0) return;
  SND.ambT = 4 + Math.random() * 10;
  const a = Math.random() * TAU, r = 15 + Math.random() * 25, p = v3(CAM.pos.x + Math.cos(a) * r, CAM.pos.y + 2 + Math.random() * 8, CAM.pos.z + Math.sin(a) * r), az = (m, n) => m + (1 + ((Math.random() * n) | 0));
  let n = null;
  if (tipo === 'campo') n = noche ? az('AM_bicho', 8) : Math.random() < 0.5 ? az('AM_ave', 7) : az('AM_pajaro', 6);
  else if (tipo === 'desierto') n = az('AM_rafaga', 2);
  else if (tipo === 'ciudad' && Math.random() < 0.45) n = 'AM_camion';
  if (n) sonar(n, p, 0.4 * k, 0.95 + Math.random() * 0.1);
}
function sonidosPaso(dt) { if (JUEGO.estado !== 'juego') return; sonPasos(dt); sonAmbiente(dt); }
