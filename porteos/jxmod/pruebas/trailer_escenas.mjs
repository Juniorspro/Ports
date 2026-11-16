// las escenas del tráiler (pruebas/trailer.mjs): de cuándo a cuándo (segundos del tráiler), el mapa, qué se pone, la
// cámara de cada cuadro (p: dónde está, m: adónde mira; __tr.t es el segundo del tráiler, __tr.u de 0 a 1 en la escena) y
// los títulos. La música (Kevin MacLeod, «Volatile Reaction», CC BY 4.0) empieza en su segundo 18,14: el drop cae en el
// 12,00 del tráiler y cada compás dura 1,532 s (156,6 por minuto): los cortes van cada 2 compases (3,064 s).
// Los personajes son los propios del juego (nada de personajes de otras marcas).
export const FPS = 60;
const BEAT = 0.383, C = (k) => +(12 - 3.064 * 4 + 3.064 * k).toFixed(3);   // (C(0) = -0,256 … C(4) = 12,0 … los cortes)
// (lo común: limpiar, los títulos y el logo; se pone al principio de cada escena)
const COMUN = `
  for (const o of OBJS.slice()) borrarObjeto(o, true); if (typeof npcTodos === 'function') npcTodos();
  if (ARM.agarre && typeof soltarFisica === 'function') soltarFisica(); ARM.agarre = null;
  DIA.ciclo = false; JUG.tercera = false; JUG.vel.set(0, 0, 0); DBG.sinVista = true; ENT.disparo = false;
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
    // (el logo del juego al medio, con una línea abajo y, si hay, la de abajo de todo)
    logo(t0, t1, sub, em, cred) {
      const t = __tr.t, o = $('trOver'); let e = o.querySelector('.trLogo');
      if (t < t0 || t > t1) { if (e) e.remove(); const c = o.querySelector('.trCred'); if (c) c.remove(); return; }
      if (!e) {
        const im = document.querySelector('#carga .dLogo img'); e = document.createElement('div'); e.className = 'trLogo';
        e.innerHTML = '<div class="dLogo"><img src="' + (window.__logoOrig || (im && im.src) || '') + '" alt=""></div>' + (sub ? '<p>' + sub + '</p>' : '') + (em ? '<em>' + em + '</em>' : ''); o.appendChild(e);
        if (cred) { const c = document.createElement('div'); c.className = 'trCred'; c.innerHTML = cred; o.appendChild(c); }
      }
      const a = Math.min(1, (t - t0) / 0.45), ea = 1 - Math.pow(1 - a, 3), z = Math.min(1, (t1 - t) / 0.25);
      e.style.opacity = Math.min(ea, z).toFixed(3); e.style.transform = 'translate(-50%,-50%) scale(' + (1.18 - 0.18 * ea + 0.03 * (t - t0)).toFixed(4) + ')';
      const p = e.querySelector('p'), m = e.querySelector('em'), c = o.querySelector('.trCred');
      if (p) p.style.opacity = Math.min(1, Math.max(0, (t - t0 - 0.35) / 0.3)).toFixed(3);
      if (m) m.style.opacity = Math.min(1, Math.max(0, (t - t0 - 0.6) / 0.3)).toFixed(3);
      if (c) c.style.opacity = (Math.min(1, Math.max(0, (t - t0 - 0.9) / 0.4)) * z).toFixed(3);
    },
    negro(v) { let e = document.querySelector('#trOver .trNegro'); if (!e) { e = document.createElement('div'); e.className = 'trNegro'; $('trOver').prepend(e); } e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); },
    blanco(v) { let e = document.querySelector('#trOver .trBlanco'); if (!e) { e = document.createElement('div'); e.className = 'trBlanco'; $('trOver').appendChild(e); } e.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); },
    barras(on) { $('trOver').classList.toggle('trBarras', !!on); },
    // (la cámara: suave entre dos puntos, y un temblor que se apaga)
    lerp(a, b, k) { return a.map((x, i) => x + (b[i] - x) * k); },
    suave(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); },
    temblor(t, t0, f) { const d = t - t0; if (d < 0 || d > 0.9) return [0, 0, 0]; const k = f * Math.exp(-d * 5); return [Math.sin(d * 71) * k, Math.sin(d * 53 + 1) * k * 0.7, Math.sin(d * 61 + 2) * k]; },
    piso(x, z, y0) { return pisoBajo(v3(x, (y0 === undefined ? 50 : y0) + 5, z), 120) || 0; },
  };`;
const A = 'window.__A';   // (los puntos de la escena, medidos al prepararla)
// (el lugar de partida: el spawn del mapa y hacia dónde mira; ad: adelante, ld: al costado)
const BASE = `const s0 = MUNDO.spawns[0], y0 = JUG.yaw, ad = v3(Math.sin(y0), 0, Math.cos(y0)), ld = v3(Math.cos(y0), 0, -Math.sin(y0));
  const at = (f, l, y) => v3(s0.x + ad.x * f + ld.x * l, (y === undefined ? s0.y : y), s0.z + ad.z * f + ld.z * l);`;
const PJ = ['Hero', 'Soldier', 'Ninja', 'Robot', 'Astronauta', 'Pirata', 'Bombera', 'Engineer', 'Zombi', 'Swat', 'Partygoer'];
export const ESCENAS = {
  // ---- 1. el logo sobre el monolito de JXMod al atardecer ----
  intro: {
    t0: 0, t1: C(1), mapa: 'FlatGrass', espera: 1200, antes: 30,
    preparar: COMUN + `DIA.hora = 17.3; DIA.aplicada = -1; ${BASE} ${A} = { at, s0, ad }; return 1;`,
    cam: `const k = TRH.suave(__tr.u), a = ${A}.at, s = ${A}.s0; const p = a(-2 + k * 6, 1.5, s.y + 1.4 + k * 0.9), m = a(60, 0, s.y + 3.5 + k); return { p: [p.x, p.y, p.z], m: [m.x, m.y, m.z] };`,
    titulos: `const t = __tr.t; TRH.negro(t < 0.7 ? 1 - 0.55 * TRH.suave(t / 0.7) : 0.45 + 0.55 * TRH.suave((t - 2.55) / 0.25)); TRH.logo(0.15, 2.8, 'Sandbox · Física · Multijugador');`,
  },
  // ---- 2. la ciudad desde arriba ----
  ciudad: {
    t0: C(1), t1: C(2), mapa: 'City', espera: 2500, antes: 30,
    preparar: COMUN + `DIA.hora = 16.8; DIA.aplicada = -1; ${BASE} ${A} = { at, s0 }; return 1;`,
    cam: `const k = TRH.suave(__tr.u), a = ${A}.at, s = ${A}.s0; const p = a(-18 + k * 22, -14 + k * 6, s.y + 26 - k * 6), m = a(40, 6, s.y); return { p: [p.x, p.y, p.z], m: [m.x, m.y, m.z] };`,
    titulos: `TRH.titulo('t2', '<b>MUNDOS <i>ENTEROS</i></b><u></u><small>ciudades · desiertos · el espacio</small>', ${C(1)} + 0.15, ${C(2)} - 0.05);`,
  },
  // ---- 3. los personajes en fila ----
  gente: {
    t0: C(2), t1: C(3), mapa: 'FlatGrass', espera: 2500, antes: 60,
    preparar: COMUN + `DIA.hora = 16.2; DIA.aplicada = -1; ${BASE}
      const L = ${JSON.stringify(PJ.slice(0, 8))}, E = ['Hi', 'Victory', 'Clap', 'rb:HipHop', 'rb:YMCA', 'rb:Shuffle', 'Techno', 'rb:Gangnam'], c = at(8, 0);
      const y = TRH.piso(c.x, c.z, s0.y); L.forEach((sk, i) => { const p = at(8, (i - 3.5) * 1.5); p.y = TRH.piso(p.x, p.z, s0.y); const P = npcCrear(sk, p, y0 + Math.PI, { modo: 'bailar', emote: E[i], vel: 1 }); });
      ${A} = { at, y }; return L.length;`,
    cam: `const k = TRH.suave(__tr.u), a = ${A}.at, y = ${A}.y; const p = a(4.9, 5.2 - k * 10.4, y + 1.25), m = a(8, 3.6 - k * 7.2, y + 1.0); return { p: [p.x, p.y, p.z], m: [m.x, m.y, m.z] };`,
    titulos: `TRH.titulo('t3', '<b>SÉ <i>QUIEN QUIERAS</i></b><u></u><small>decenas de personajes</small>', ${C(2)} + 0.15, ${C(3)} - 0.05);`,
  },
  // ---- 4. la Physics Gun nueva agarrando una caja (en primera persona) ----
  fisica: {
    t0: C(3), t1: 12.0, mapa: 'FlatGrass', espera: 1500, antes: 40,
    preparar: COMUN + `DBG.sinVista = false; DIA.hora = 16.5; DIA.aplicada = -1; ${BASE}
      elegirArma(ARM.lista.indexOf('PhysicsGun'));
      const c = at(4.5, 0.4); c.y = TRH.piso(c.x, c.z, s0.y) + 0.6; const o = crearObjeto('BarrilExplosivo', c, new Quat(), {});
      ${A} = { y0, o }; return 1;`,
    // (mira al barril —ya en el piso— y lo agarra; después lo levanta y lo pasea)
    listo: `const b = ${A}.o.b || ${A}.o.body || ${A}.o; for (let r = 0; r < 3; r++) { const e = CAM.pos, d = vsub(b.pos, e); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); for (let i = 0; i < 4; i++) cuadro(window.__T += 1000 / 60); }
      ${A}.y0 = JUG.yaw; ${A}.p0 = JUG.pitch; ENT.disparo = true; for (let i = 0; i < 3; i++) cuadro(window.__T += 1000 / 60); window.__agarro = !!ARM.agarre;`,
    cada: `ENT.disparo = true; if (__tr.i >= 0) { const k = TRH.suave(__tr.u); JUG.yaw = ${A}.y0 + Math.sin(k * 3.1) * 0.5; JUG.pitch = ${A}.p0 - k * 0.42; }`,
    titulos: `TRH.titulo('t4', '<b>AGARRÁ <i>TODO</i></b><u></u><small>con la Physics Gun</small>', ${C(3)} + 0.15, 11.8); TRH.blanco(Math.max(0, (__tr.t - 11.82) / 0.18));`,
  },
  // ---- 5. el drop (12,00): los barriles explotan en el golpe; «ROMPÉ TODO» ----
  drop: {
    t0: 12.0, t1: C(5), mapa: 'FlatGrass', espera: 1500, antes: 40,
    preparar: COMUN + `DIA.hora = 16.5; DIA.aplicada = -1; ${BASE} const B = [];
      for (const [j, l] of [[0, 7], [1, 2.4], [2, -2.4], [3, -7]].map(([j, l]) => [j, l])) { const c = at(17 + (j % 2) * 3, l); c.y = TRH.piso(c.x, c.z, s0.y); B.push(c);
        for (let f = 0; f < 2; f++) for (let i = 0; i < 3 - f; i++) crearObjeto('BarrilExplosivo', v3(c.x + ld.x * (i - (2 - f) / 2) * 0.75, c.y + 0.5 + f, c.z + ld.z * (i - (2 - f) / 2) * 0.75), new Quat(), {});
        crearObjeto(j === 1 ? 'Sedan' : j % 2 ? 'Contenedor' : 'CajaMadera', v3(c.x - ad.x * 2.4, c.y + 1, c.z - ad.z * 2.4), Quat.axis(0, 1, 0, y0 + j), {}); }
      ${A} = { B, at, s0, n: 0 }; return B.length;`,
    cada: `const A2 = ${A}; while (A2.n < A2.B.length && __tr.t >= 12 + A2.n * ${BEAT}) { const c = A2.B[A2.n++]; explosion(v3(c.x, c.y + 1, c.z), 9, 160); }`,
    cam: `const t = __tr.t, k = TRH.suave(__tr.u), a = ${A}.at, s = ${A}.s0, nb = Math.floor(Math.max(0, Math.min(3, (t - 12) / ${BEAT}))), sh = TRH.temblor(t, 12 + nb * ${BEAT}, 0.3);
      const p = a(1 - k * 4, 0, s.y + 1.5 + k * 2.5), m = a(18, 0, s.y + 2 + k * 2); return { p: [p.x + sh[0], p.y + sh[1], p.z + sh[2]], m: [m.x, m.y, m.z] };`,
    titulos: `TRH.blanco(1 - (__tr.t - 12) / 0.25); TRH.golpe('t5', '<b>ROMPÉ <i>TODO</i></b><u></u>', 12.12, ${C(5)} - 0.08);`,
  },
  // ---- 6. llueven cosas: construí, lanzá ----
  construir: {
    t0: C(5), t1: C(6), mapa: 'FlatGrass', espera: 1500, antes: 30,
    preparar: COMUN + `DIA.hora = 15.5; DIA.aplicada = -1; ${BASE} const c = at(10, 6); c.y = TRH.piso(c.x, c.z, s0.y);
      crearObjeto('Sedan', v3(c.x - 3, c.y + 1, c.z + 2), Quat.axis(0, 1, 0, 0.6), {});
      ${A} = { c, n: 0, L: ['CajaMadera', 'Crate', 'Box4', 'Box2', 'Barrel', 'WoodenBox', 'Pelota', 'Cubeta', 'Contenedor'] }; return 1;`,
    cada: `if (__tr.i >= 0 && __tr.i % 4 === 0 && ${A}.n < 40) { const A2 = ${A}, c = A2.c, k = A2.n++, a = k * 2.4, r = 0.6 + (k % 5) * 0.45;
      crearObjeto(A2.L[k % A2.L.length], v3(c.x + Math.cos(a) * r, c.y + 9 + (k % 3) * 1.5, c.z + Math.sin(a) * r), Quat.axis(0.3, 1, 0.2, a), {}); }`,
    cam: `const k = TRH.suave(__tr.u), c = ${A}.c, an = 2.4 + k * 0.9; return { p: [c.x + Math.sin(an) * 9, c.y + 2.2 + k * 1.2, c.z + Math.cos(an) * 9], m: [c.x, c.y + 2.2, c.z] };`,
    titulos: `TRH.titulo('t6', '<b>CONSTRUÍ, <i>LANZÁ</i>, ROMPÉ</b><u></u><small>cientos de objetos</small>', ${C(5)} + 0.15, ${C(6)} - 0.05);`,
  },
  // ---- 7. la fiesta: todos bailando ----
  baile: {
    t0: C(6), t1: C(7), mapa: 'FlatGrass', espera: 2500, antes: 60,
    preparar: COMUN + `DIA.hora = 17.4; DIA.aplicada = -1; ${BASE} const c = at(9, -5); c.y = TRH.piso(c.x, c.z, s0.y);
      const L = ${JSON.stringify(PJ)}, E = ['rb:Gangnam', 'Techno', 'rb:YMCA', 'rb:Shuffle', 'ChickenDance', 'rb:HipHop', 'Twerk', 'rb:Breakdance', 'Flair', 'rb:Boxeo', 'Techno'];
      L.forEach((sk, i) => { const an = i / L.length * 6.283, r = i % 2 ? 1.7 : 2.9, p = v3(c.x + Math.cos(an) * r, 0, c.z + Math.sin(an) * r); p.y = TRH.piso(p.x, p.z, c.y); npcCrear(sk, p, Math.atan2(c.x - p.x, c.z - p.z), { modo: 'bailar', emote: E[i], vel: 1 }); });
      ${A} = { c }; return L.length;`,
    cam: `const k = TRH.suave(__tr.u), c = ${A}.c, an = 0.4 + k * 1.2; return { p: [c.x + Math.sin(an) * 6.2, c.y + 2.1 - k * 0.6, c.z + Math.cos(an) * 6.2], m: [c.x, c.y + 0.9, c.z] };`,
    titulos: `TRH.titulo('t7', '<b>ARMÁ LA <i>FIESTA</i></b><u></u><small>bailes y emotes</small>', ${C(6)} + 0.15, ${C(7)} - 0.05);`,
  },
  // ---- 8. el Construct desde adentro ----
  construct: {
    t0: C(7), t1: C(8), mapa: 'RB_Construct', espera: 2500, antes: 30,
    preparar: COMUN + `DIA.hora = 14; DIA.aplicada = -1; ${BASE} ${A} = { at, s0 }; return 1;`,
    cam: `const k = TRH.suave(__tr.u), a = ${A}.at, s = ${A}.s0; const h = 26 - k * 13; const p = a(h * 0.8, -3 + k * 6, s.y + h), m = a(-30, -2 + k * 3, s.y + h * 0.3); return { p: [p.x, p.y, p.z], m: [m.x, m.y, m.z] };`,
    titulos: `TRH.titulo('t8', '<b>MAPAS Y <i>MODS</i></b><u></u><small>de la comunidad</small>', ${C(7)} + 0.15, ${C(8)} - 0.05);`,
  },
  // ---- 9. muñecos de trapo: una explosión en el medio de un grupo, en cámara lenta ----
  ragdolls: {
    t0: C(8), t1: C(9), mapa: 'FlatGrass', espera: 2000, antes: 60,
    preparar: COMUN + `DIA.hora = 17.2; DIA.aplicada = -1; ${BASE} const c = at(9, 4); c.y = TRH.piso(c.x, c.z, s0.y);
      const L = ['Zombi', 'Zombi', 'Soldier', 'Zombi', 'Robot', 'Zombi'];
      L.forEach((sk, i) => { const an = i * 1.05, p = v3(c.x + Math.cos(an) * 1.6, 0, c.z + Math.sin(an) * 1.6); p.y = TRH.piso(p.x, p.z, c.y); npcCrear(sk, p, y0 + Math.PI, { modo: 'quieto', emote: '' }); });
      crearObjeto('BarrilExplosivo', v3(c.x, c.y + 0.5, c.z), new Quat(), {});
      ${A} = { c, y0 }; return L.length;`,
    cada: `const t0 = ${C(8)} + 2 * ${BEAT}; if (__tr.t >= t0 && !${A}.boom) { ${A}.boom = 1; const c = ${A}.c; explosion(v3(c.x, c.y + 0.6, c.z), 7, 120); }`,
    ritmo: `const t = __tr.t, t0 = ${C(8)} + 2 * ${BEAT}; return t < t0 + 0.05 ? 1 : t < t0 + 1.6 ? 0.28 : 0.28 + (t - t0 - 1.6) * 1.2;`,
    cam: `const t = __tr.t, k = TRH.suave(__tr.u), c = ${A}.c, an = ${A}.y0 + Math.PI + 0.5 + k * 0.5, sh = TRH.temblor(t, ${C(8)} + 2 * ${BEAT}, 0.2);
      return { p: [c.x + Math.sin(an) * 9 + sh[0], c.y + 1.3 + k * 1.5 + sh[1], c.z + Math.cos(an) * 9 + sh[2]], m: [c.x, c.y + 1.6, c.z] };`,
    titulos: `TRH.golpe('t9', '<b>FÍSICA <i>DE VERDAD</i></b><u></u>', ${C(8)} + 2 * ${BEAT} + 0.1, ${C(9)} - 0.05);`,
  },
  // ---- 10. con amigos: un grupo charlando en la calle ----
  amigos: {
    t0: C(9), t1: C(10), mapa: 'City', espera: 2500, antes: 60,
    preparar: COMUN + `DIA.hora = 17.6; DIA.aplicada = -1; ${BASE} const c = at(7, 0); c.y = TRH.piso(c.x, c.z, s0.y + 2);
      const L = [['Hero', 'Hi', '¡Hola!'], ['Pirata', 'Clap', 'jajaja'], ['Astronauta', 'Victory', '¡vamos!'], ['Bombera', 'rb:HipHop', 'dale'], ['Robot', 'Flair', 'GG']];
      ${A} = { c, y0, P: [] };
      L.forEach(([sk, e, d], i) => { const an = y0 + Math.PI + (i - 2) * 0.55, p = v3(c.x + Math.sin(an) * 2.4, 0, c.z + Math.cos(an) * 2.4); p.y = TRH.piso(p.x, p.z, c.y + 2); const P = npcCrear(sk, p, Math.atan2(c.x - p.x, c.z - p.z), { modo: 'bailar', emote: e, vel: 1 }); if (P) ${A}.P.push([P, d, i]); });
      return L.length;`,
    cada: `if (__tr.i >= 0) for (const [P, d, i] of ${A}.P) if (__tr.i === 20 + i * 22) npcDecir(P, d);`,
    cam: `const k = TRH.suave(__tr.u), c = ${A}.c, an = ${A}.y0 + Math.PI + 0.9 - k * 0.6; return { p: [c.x + Math.sin(an) * 5.6, c.y + 1.7, c.z + Math.cos(an) * 5.6], m: [c.x, c.y + 1.1, c.z] };`,
    titulos: `TRH.titulo('t10', '<b>JUGÁ CON <i>AMIGOS</i></b><u></u><small>salas online · gratis</small>', ${C(9)} + 0.15, ${C(10)} - 0.05);`,
  },
  // ---- 11. el desierto: del día a la noche ----
  desierto: {
    t0: C(10), t1: C(11), mapa: 'Desert', espera: 2500, antes: 30,
    preparar: COMUN + `DIA.hora = 16.5; DIA.aplicada = -1; ${BASE} ${A} = { at, s0 }; return 1;`,
    cada: `DIA.hora = 16.6 + __tr.u * 2.8; DIA.aplicada = -1;`,
    cam: `const k = TRH.suave(__tr.u), a = ${A}.at, s = ${A}.s0; const p = a(-24, 26 + k * 14, s.y + 7 + k * 2), m = a(-300, 200 - k * 60, s.y + 22); return { p: [p.x, p.y, p.z], m: [m.x, m.y, m.z] };`,
    titulos: `TRH.titulo('t11', '<b>DÍA Y <i>NOCHE</i></b><u></u><small>con su cielo y su luz</small>', ${C(10)} + 0.15, ${C(11)} - 0.05);`,
  },
  // ---- 12. el espacio ----
  espacio: {
    t0: C(11), t1: C(12), mapa: 'Space', espera: 2500, antes: 30,
    preparar: COMUN + `${BASE} const lo = MUNDO.lo, hi = MUNDO.hi, c = lo && hi ? v3((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2) : v3(s0.x, s0.y, s0.z); ${A} = { c, y0 }; return 1;`,
    cam: `const k = TRH.suave(__tr.u), c = ${A}.c, an = ${A}.y0 + Math.PI + 0.7 - k * 1.1, r = 17 - k * 3; return { p: [c.x + Math.sin(an) * r, c.y + 7 - k * 3, c.z + Math.cos(an) * r], m: [c.x, c.y - 0.5, c.z] };`,
    titulos: `TRH.titulo('t12', '<b>HASTA EL <i>ESPACIO</i></b><u></u>', ${C(11)} + 0.15, ${C(12)} - 0.05);`,
  },
  // ---- 13. el final: una cadena de explosiones al ritmo ----
  final: {
    t0: C(12), t1: C(13), mapa: 'FlatGrass', espera: 1500, antes: 40,
    preparar: COMUN + `DIA.hora = 17.8; DIA.aplicada = -1; ${BASE} const B = [];
      for (let j = 0; j < 6; j++) { const c = at(19 + (j % 2) * 2.5, 10 - j * 4); c.y = TRH.piso(c.x, c.z, s0.y); B.push(c); for (let i = 0; i < 3; i++) crearObjeto('BarrilExplosivo', v3(c.x + (i - 1) * 0.75, c.y + 0.5, c.z), new Quat(), {}); crearObjeto(j % 2 ? 'Sedan' : 'Contenedor', v3(c.x, c.y + 1.2, c.z + 2.5), Quat.axis(0, 1, 0, j), {}); }
      ${A} = { B, at, s0, n: 0 }; return B.length;`,
    cada: `const A2 = ${A}, t0 = ${C(12)} + ${BEAT}; while (A2.n < A2.B.length && __tr.t >= t0 + A2.n * ${BEAT}) { const c = A2.B[A2.n++]; explosion(v3(c.x, c.y + 1, c.z), 8, 150); }`,
    cam: `const t = __tr.t, k = TRH.suave(__tr.u), a = ${A}.at, s = ${A}.s0, sh = TRH.temblor(t, ${C(12)} + ${BEAT} + Math.floor(Math.max(0, Math.min(5, (t - ${C(12)} - ${BEAT}) / ${BEAT}))) * ${BEAT}, 0.18);
      const p = a(1 - k * 4, 0, s.y + 2 + k * 2.5), m = a(20, 0, s.y + 2.5 + k); return { p: [p.x + sh[0], p.y + sh[1], p.z + sh[2]], m: [m.x, m.y, m.z] };`,
    titulos: `TRH.golpe('t13', '<b>SIN <i>LÍMITES</i></b><u></u>', ${C(12)} + ${BEAT} * 3 + 0.05, ${C(13)} - 0.05);`,
  },
  // ---- 14. el cierre: el logo, gratis, y el crédito de la música ----
  fin: {
    t0: C(13), t1: 45, mapa: 'FlatGrass', espera: 1200, antes: 30,
    preparar: COMUN + `DIA.hora = 17.6; DIA.aplicada = -1; ${BASE} ${A} = { at, s0 }; return 1;`,
    cam: `const k = TRH.suave(__tr.u), a = ${A}.at, s = ${A}.s0; const p = a(8 - k * 10, -1.5, s.y + 2 + k * 5), m = a(60, 0, s.y + 8); return { p: [p.x, p.y, p.z], m: [m.x, m.y, m.z] };`,
    titulos: `const t = __tr.t; TRH.negro(0.6 * TRH.suave((t - ${C(13)}) / 0.5) + 0.4 * TRH.suave((t - 44.1) / 0.85));
      TRH.logo(${C(13)} + 0.2, 44.95, 'Sandbox · Física · Multijugador', 'Gratis · Android y web', 'Música: Kevin MacLeod — «Volatile Reaction» (incompetech.com) · CC BY 4.0');`,
  },
};
