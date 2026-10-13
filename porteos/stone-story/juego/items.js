// Objetos: armas y herramientas (prefabs con componente Weapon), sus tablas por nivel (archivo
// <id>.txt con damage/attack_speed) y el inventario guardado.
'use strict';
const Items = (() => {
  const I = {};
  let cat = null;
  I.catalogo = () => {
    if (cat) return cat;
    cat = {};
    for (const [k, e] of Object.entries(Datos.prefabs)) {
      const w = e.c.find((c) => c._c === 'Weapon' && c.id);
      if (!w || cat[w.id]) continue;
      // solo la raiz del prefab (el arma "suelta" de un enemigo es un hijo con id default_enemy_weapon)
      if (/default_enemy/.test(w.id)) continue;
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

  // estadisticas de un objeto del inventario {id, nivel}
  I.stats = (it) => {
    const c = I.catalogo()[it.id];
    if (!c) return null;
    const w = c.w, tb = I.tabla(it.id) || {};
    const nv = Math.max(0, (it.nivel || w.level || 1));
    let dano = w.baseDamage || 1;
    if (tb.damage) dano = tb.damage[Math.min(nv, tb.damage.length - 1)];
    const vel = tb.attack_speed ? tb.attack_speed[Math.min(nv, tb.attack_speed.length - 1)] : 0;
    return {
      dano, rango: w.baseRange || 1, carga: Math.max(2, (w.cast || 10) - Math.floor(vel / 3)), golpe: w.perf || 5,
      enfriar: w.cooldown || 0, herramienta: c.tool ? c.tool.resourceType : 0, manos: w.handType || 2, bala: w.bulletPrefab, c,
    };
  };

  I.dar = (id, nivel) => {
    Prog.items[id] = Prog.items[id] || { id, nivel: nivel || (I.catalogo()[id] ? I.catalogo()[id].w.level || 1 : 1), n: 0 };
    Prog.items[id].n++;
    // primera arma: a la mano derecha
    const s = I.stats(Prog.items[id]);
    if (s && !s.herramienta && !Prog.mano) Prog.mano = id;
    Prog.guardar();
  };
  I.tiene = (id) => !!Prog.items[id];
  // herramienta para un tipo de recurso (1 piedra/pala, 2 madera/hacha...)
  I.herramienta = (tipo) => Object.values(Prog.items).find((it) => { const s = I.stats(it); return s && s.herramienta === tipo; });
  return I;
})();
