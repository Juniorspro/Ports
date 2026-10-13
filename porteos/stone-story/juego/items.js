// Objetos: armas y herramientas (prefabs con componente Weapon), sus tablas por nivel (archivo
// <id>.txt con damage/attack_speed) y el inventario guardado.
'use strict';
const Items = (() => {
  const I = {};
  let cat = null;
  I.catalogo = () => {
    if (cat) return cat;
    cat = {};
    // primero los que tienen ruta propia (weapons/, relics/...): el id de un arma de enemigo puede repetirse
    const conRuta = new Set(Object.values(Datos.rutas));
    const ks = Object.keys(Datos.prefabs).sort((a, b) => conRuta.has(b) - conRuta.has(a));
    for (const k of ks) {
      const e = Datos.prefabs[k];
      const w = e.c.find((c) => (c._c === 'Weapon' || c._c === 'TreasureItem' || c._c === 'Item') && c.id);
      if (!w || cat[w.id] || /default_enemy/.test(w.id)) continue;
      cat[w.id] = { id: w.id, pref: k, w, tool: e.c.find((c) => c._c === 'HarvestTool') };
    }
    return cat;
  };
  I.tabla = (id) => {
    const t = Datos.texto(id);
    if (!t || !t.trim().startsWith('{')) return null;
    try { return slim(t); } catch (e) { return null; }
  };
  I.nombre = (id) => { const c = I.catalogo()[id]; return c ? T(c.w.displayName || id) : id; };

  // valor de una estadistica (ItemData.Stat): tabla "@nombre" del <id>.txt por nivel, o base + mult * nivel
  I.stat = (it, tipo) => {
    const c = I.catalogo()[it.id];
    if (!c || !c.w.baseStats) return 0;
    const tb = I.tabla(it.id) || {};
    let tot = 0;
    for (const s of c.w.baseStats) {
      if (s.type !== tipo || (s.rareStatOnly && !it.raro)) continue;
      const nv = it.nivel || c.w.level || 1;
      let v;
      const cp = (s.customParams || [])[0];
      if (cp && cp[0] === '@' && tb[cp.slice(1)]) { const a = tb[cp.slice(1)]; v = a[Math.min(nv, a.length - 1)]; }
      else v = (s.baseValue || 0) + (s.levelMult || 0) * nv;
      if (s.minValue !== undefined && v < s.minValue) v = s.minValue;
      if (s.floorResult) v = Math.floor(v);
      tot += v;
    }
    return tot;
  };
  // ST: 1 dano, 3 armadura, 6 vel. de ataque, 17 armadura/s, 18 armadura max, 19 alcance
  I.stats = (it) => {
    const c = I.catalogo()[it.id];
    if (!c || c.w._c !== 'Weapon') return null;
    const w = c.w;
    const vel = I.stat(it, 6);
    const dano = Math.max(w.baseDamage || 0, I.stat(it, 1)) || (w.baseStats ? 0 : 1);
    const bp = Obj.prefabDeComp(w.bulletPrefab);
    const bc = bp && Datos.prefabs[bp].c.find((x) => x.velocity !== undefined);
    return {
      dano, rango: (w.baseRange || 1) + I.stat(it, 19), carga: Math.max(2, (w.cast || 10) - Math.floor(vel / 3)), golpe: w.perf || 5,
      enfriar: w.cooldown >= 9999 ? 0 : (w.cooldown || 0), ataca: !(w.cooldown >= 9999), herramienta: c.tool ? c.tool.resourceType : 0,
      manos: w.handType || 0, armSeg: I.stat(it, 17), armMax: I.stat(it, 18) + I.stat(it, 3),
      bala: bc && (bc.velocity || 0) > 0 && (bc.tags || []).includes('ranged') ? { pref: bp, c: bc } : null, c,
    };
  };
  I.dar = (id, nivel) => {
    Prog.items[id] = Prog.items[id] || { id, nivel: nivel || (I.catalogo()[id] ? I.catalogo()[id].w.level || 1 : 1), n: 0 };
    Prog.items[id].n++;
    // primera arma: a la mano derecha
    const s = I.stats(Prog.items[id]);
    if (s && !s.herramienta) {
      if (s.ataca && !Prog.mano) Prog.mano = id;
      else if (!s.ataca && !Prog.manoI) Prog.manoI = id;
    }
    Prog.guardar();
  };
  I.tiene = (id) => !!Prog.items[id];
  // cofres: elige una entrada de treasures.txt segun el lugar y la vuelta, y da sus objetos
  const PREF = { rocky_plateau: 'rocky_plateau', deadwood_valley: 'deadwood', caustic_caves: 'caustic_caves', bronze_mine: 'mine',
    icy_ridge: 'icy', temple: 'temple', undead_crypt: 'crypt', fungus_forest: 'mushroom' };
  I.abrirCofre = (questId, nivel) => {
    let tb;
    try { tb = slim(Datos.texto('treasures')).treasures; } catch (e) { tb = []; }
    const pref = PREF[questId] || questId;
    const cand = tb.filter((t) => t.id.startsWith(pref + '_'));
    let t = null;
    for (const c of cand) { const n = parseInt(c.id.slice(pref.length + 1)); if (!isNaN(n) && n <= nivel + 1 && (!t || n > parseInt(t.id.slice(pref.length + 1)))) t = c; }
    t = t || cand[0] || tb.find((x) => x.id === 'rocky_plateau_1');
    const dados = [];
    if (!t) return dados;
    // cofres chicos: uno de la lista; grandes: todos
    const lista = t.type === 'Humble' ? [t.items[Math.floor(Math.random() * t.items.length)]] : t.items;
    for (const it of lista) {
      if (!I.catalogo()[it.id]) continue;
      const n = (it.countMin || 1) + Math.floor(Math.random() * ((it.countMax || it.countMin || 1) - (it.countMin || 1) + 1));
      const nv = Math.max(1, nivel + 1);
      for (let k = 0; k < n; k++) {
        const ya = Prog.items[it.id];
        if (ya && ya.nivel < nv) ya.nivel = nv;
        I.dar(it.id, nv);
        dados.push(it.id);
      }
    }
    return dados;
  };
  // herramienta para un tipo de recurso (1 piedra/pala, 2 madera/hacha...)
  I.herramienta = (tipo) => Object.values(Prog.items).find((it) => { const s = I.stats(it); return s && s.herramienta === tipo; });
  return I;
})();
