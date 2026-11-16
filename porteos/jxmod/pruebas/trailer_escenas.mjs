// las escenas del tráiler (pruebas/trailer.mjs): de cuándo a cuándo (segundos del tráiler), el mapa, qué se pone, la
// cámara de cada cuadro (p: dónde está, m: adónde mira; __tr.t es el segundo del tráiler, __tr.u de 0 a 1 en la escena) y
// los títulos. La música (Kevin MacLeod, «Volatile Reaction», CC BY 4.0) empieza en su segundo 18,14: el drop cae en el
// 12,00 del tráiler y cada compás dura 1,532 s (156,6 por minuto): los cortes van cada 2 compases.
export const FPS = 60;
// (lo común: limpiar, los títulos y el logo; se pone al principio de cada escena)
const COMUN = `
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  DIA.ciclo = false; JUG.tercera = false; JUG.vel.set(0, 0, 0);
  window.TRH = {
    titulo(id, html, t0, t1, cls) {
      const t = __tr.t, o = $('trOver'); let e = document.getElementById(id);
      if (t < t0 || t > t1) { if (e) e.remove(); return; }
      if (!e) { e = document.createElement('div'); e.id = id; e.className = 'trT ' + (cls || ''); e.innerHTML = html; o.appendChild(e); }
      const a = Math.min(1, (t - t0) / 0.3), z = Math.min(1, (t1 - t) / 0.2), ea = 1 - Math.pow(1 - a, 3), b = e.querySelector('b'), u = e.querySelector('u'), s = e.querySelector('small');
      e.style.opacity = z; e.style.transform = 'translateY(' + ((1 - z) * 24).toFixed(1) + 'px)';
      if (b) { b.style.clipPath = 'inset(-20% ' + ((1 - ea) * 100).toFixed(1) + '% -20% 0)'; b.style.transform = 'skewX(-7deg) translateX(' + ((1 - ea) * -50).toFixed(1) + 'px)'; }
      if (u) u.style.transform = 'scaleX(' + Math.min(1, Math.max(0, (t - t0 - 0.12) / 0.35)).toFixed(3) + ')';
      if (s) s.style.opacity = Math.min(1, Math.max(0, (t - t0 - 0.22) / 0.2)).toFixed(3);
    },
    // (un golpe: el título entra grande y cae a su tamaño, como un sello)
    golpe(id, html, t0, t1, cls) {
      const t = __tr.t, o = $('trOver'); let e = document.getElementById(id);
      if (t < t0 || t > t1) { if (e) e.remove(); return; }
      if (!e) { e = document.createElement('div'); e.id = id; e.className = 'trT ' + (cls || ''); e.innerHTML = html; o.appendChild(e); }
      const a = Math.min(1, (t - t0) / 0.16), z = Math.min(1, (t1 - t) / 0.18), s = 1 + (1 - a) * 0.9;
      e.style.opacity = Math.min(a * 1.5, z); e.style.transform = 'scale(' + s.toFixed(3) + ')';
      const u = e.querySelector('u'); if (u) u.style.transform = 'scaleX(' + Math.min(1, Math.max(0, (t - t0 - 0.1) / 0.3)).toFixed(3) + ')';
    },
    negro(v) { let e = document.querySelector('#trOver .trNegro'); if (!e) { e = document.createElement('div'); e.className = 'trNegro'; $('trOver').prepend(e); } e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); },
    barras(on) { $('trOver').classList.toggle('trBarras', !!on); },
    // (la cámara: suave entre dos puntos, y un temblor que se apaga)
    lerp(a, b, k) { return a.map((x, i) => x + (b[i] - x) * k); },
    suave(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    temblor(t, t0, f) { const d = t - t0; if (d < 0 || d > 0.9) return [0, 0, 0]; const k = f * Math.exp(-d * 5); return [Math.sin(d * 71) * k, Math.sin(d * 53 + 1) * k * 0.7, Math.sin(d * 61 + 2) * k]; },
  };`;
const A = 'window.__A';   // (los puntos de la escena, medidos al prepararla)
export const ESCENAS = {
  // ---- el drop (12,00): los barriles explotan en el golpe; «ROMPÉ TODO» ----
  drop: {
    t0: 12.0, t1: 15.064, mapa: 'FlatGrass', espera: 1500, antes: 40,
    preparar: COMUN + `
      DIA.hora = 16.5; DIA.aplicada = -1;
      const s = MUNDO.spawns[0], c = v3(s.x + 14, s.y, s.z + 10); ${A} = { c };
      const piso = pisoBajo(v3(c.x, c.y + 5, c.z), 20) || c.y;
      // (una pila de barriles explosivos y cajas alrededor)
      let n = 0; for (let f = 0; f < 3; f++) for (let i = 0; i < 4 - f; i++) { crearObjeto('BarrilExplosivo', v3(c.x + (i - (3 - f) / 2) * 0.75, piso + 0.5 + f * 1.0, c.z), new Quat(), {}); n++; }
      for (let i = 0; i < 6; i++) { const a = i * 1.047; crearObjeto(i % 2 ? 'CajaMadera' : 'Crate', v3(c.x + Math.cos(a) * 3.2, piso + 0.6, c.z + Math.sin(a) * 3.2), Quat.axis(0, 1, 0, a), {}); }
      ${A}.piso = piso; return n;`,
    cada: `if (__tr.i === 1 || (__tr.i === -1 && 0)) {}
      if (__tr.t >= 12.0 && !${A}.boom) { ${A}.boom = 1; const c = ${A}.c; explosion(v3(c.x, ${A}.piso + 1.2, c.z), 9, 160); }`,
    cam: `const t = __tr.t, c = ${A}.c, k = TRH.suave(__tr.u), sh = TRH.temblor(t, 12.0, 0.35);
      const p = TRH.lerp([c.x - 9, ${A}.piso + 1.4, c.z - 7], [c.x - 12, ${A}.piso + 3.2, c.z - 10], k);
      return { p: [p[0] + sh[0], p[1] + sh[1], p[2] + sh[2]], m: [c.x, ${A}.piso + 1.6 + k * 0.8, c.z] };`,
    titulos: `TRH.golpe('t1', '<b>ROMPÉ <i>TODO</i></b><u></u>', 12.12, 14.95);`,
  },
};
