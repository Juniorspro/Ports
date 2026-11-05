// Cómo caminan los personajes y los NPCs (Discord: «los NPC caminan raro»). Un personaje camina en línea recta por el
// piso a distintas velocidades y se mide, cuadro por cuadro, el pie apoyado:
//  - apoyado = el pie que está abajo (la punta a menos de 2,5 cm de lo más bajo que llega ese pie, en un personaje del
//    tamaño del Hero; en proporción en los demás) y yendo para atrás respecto del cuerpo; si los dos, el más bajo. No
//    alcanza con «el más bajo»: caminando para atrás el pie que va en el aire apoya primero la punta, y el que pasa
//    rozando el piso va para adelante;
//  - patinado = cuánto se mueve el pie apoyado respecto del cuerpo (0 = clavado en el piso, 1 = patina a la velocidad del
//    cuerpo). Promedio y mediana: la mediana dice si el pie queda quieto la mayor parte del apoyo; el promedio suma el
//    aterrizaje, cuando el clip de GMod todavía frena el pie (eso viene del clip);
//  - pasos por segundo y largo del paso (caminar despacio no es correr en cámara lenta).
//  1. a 1,5 y 2 m/s (caminar, lo de los NPC «pasear»): mediana ≤ 0,2 y promedio ≤ 0,3;
//  2. a 4 y 6 m/s (trotar, correr): mediana ≤ 0,2 y promedio ≤ 0,4;
//  3. caminar y correr se distinguen: el paso a 2 m/s mide ≤ 70 % del de 6 m/s;
//  4. en diagonal, de costado y para atrás (a 2 m/s) y agachado (a 1 m/s): promedio ≤ 0,4;
//  5. sin errores de JS.
// uso: node npc_caminar.mjs URL_HTML [SKIN]
import { abrir } from './base.mjs';
const [, , HTML, SKIN = 'Hero'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000);
const medir = (v, ang = 0, ag = false) => ev(`(() => {
  const P = crearPersona(${JSON.stringify(SKIN)}, 'HatEmpty', { nombre: '' }), sub = P.D.sub;
  const ix = (re) => sub.findIndex((n) => re.test(n.n));
  let lt = ix(/LeftToeBase$/), rt = ix(/RightToeBase$/); if (lt < 0 || rt < 0) { lt = P.D.h.LeftFoot; rt = P.D.h.RightFoot; }
  // (el tamaño del personaje: alto de la cadera parado sobre el del Hero, 1,14 m; los umbrales del pie van en proporción)
  P.hum.v.fill(0); humClip(humGm().idle, 0, 1, P.hum.v); humAplicar(P); P.md.sucio = true; P.md.actualizar();
  const esc = Math.min(3, Math.max(0.2, (P.md.W[P.D.h.Hips][13] - P.md.W[lt][13]) / 1.14));
  const y0 = JUG.pos.y - 0.96; P.pos.set(JUG.pos.x + 3, y0 + 0.96, JUG.pos.z); P.yaw = 0; P.suelo = true; P.agachado = ${ag};
  const ux = Math.sin(${ang}), uz = Math.cos(${ang}); P.vel.set(ux * ${v}, 0, uz * ${v});
  // (a 60 cuadros por segundo fijos, sin depender de lo que tarde la compu de prueba)
  const F = [], dt = 1 / 60;
  for (let n = 0; n < 300; n++) {
    P.pos.x += ux * ${v} * dt; P.pos.z += uz * ${v} * dt; P.vel.set(ux * ${v}, 0, uz * ${v}); P.suelo = true; P.agachado = ${ag}; animarPersona(P, dt); ubicarPersona(P); P.md.sucio = true; P.md.actualizar();
    const A = P.md.W[lt], B = P.md.W[rt]; F.push({ dt, z: P.pos.x * ux + P.pos.z * uz, a: [A[12], A[13], A[14]], b: [B[12], B[13], B[14]] });
  }
  borrarPersona(P);
  F.splice(0, 30);   // (el arranque)
  // (lo más bajo que llega cada pie: de costado uno apoya más alto que el otro)
  const piso = { a: Math.min(...F.map((f) => f.a[1])), b: Math.min(...F.map((f) => f.b[1])) };
  let des = 0, tdes = 0, cambios = 0, ap = null, z0 = null; const largos = [], vs = [];
  for (let i = 1; i < F.length; i++) {
    const f = F[i], g = F[i - 1]; let ah = null;
    for (const k of ['a', 'b']) {
      // (abajo y yendo para atrás respecto del cuerpo: el que va en el aire va para adelante aunque roce el piso)
      const rel = ((f[k][0] - g[k][0]) * ux + (f[k][2] - g[k][2]) * uz) / f.dt - ${v};
      if (f[k][1] > piso[k] + 0.025 * esc || rel >= 0) continue;
      if (ah === null || f[k][1] < f[ah][1]) ah = k;
    }
    if (ah === null) continue;
    if (ah !== ap) { if (ap !== null) { cambios++; if (z0 !== null) largos.push(f.z - z0); z0 = f.z; } ap = ah; }
    const pie = f[ah], ant = g[ah], vz = (pie[2] - ant[2]) / f.dt, vx = (pie[0] - ant[0]) / f.dt;
    des += Math.hypot(vx, vz) * f.dt; tdes += f.dt; vs.push(Math.hypot(vx, vz));
  }
  vs.sort((a, b) => a - b);
  const T = F.reduce((s, f) => s + f.dt, 0);
  return { v: ${v}, patinado: +(tdes ? des / tdes / ${v} : 9).toFixed(2), mediana: +(vs.length ? vs[vs.length >> 1] / ${v} : 9).toFixed(2), pasosSeg: +(cambios / T).toFixed(2), largo: +(largos.length ? largos.reduce((s, x) => s + x, 0) / largos.length : 0).toFixed(2), cuadros: F.length, esc: +esc.toFixed(2) };
})()`);
const M = {}; for (const v of [1.5, 2, 4, 6]) M[v] = await medir(v);
ok('1. caminando (1,5 y 2 m/s) el pie apoyado no patina (mediana ≤ 0,2, promedio ≤ 0,3)', [M[1.5], M[2]].every((m) => m.mediana <= 0.2 && m.patinado <= 0.3), [M[1.5], M[2]]);
ok('2. trotando y corriendo (4 y 6 m/s) tampoco (mediana ≤ 0,2, promedio ≤ 0,4)', [M[4], M[6]].every((m) => m.mediana <= 0.2 && m.patinado <= 0.4), [M[4], M[6]]);
ok('3. caminar no es correr en cámara lenta: el paso a 2 m/s mide ≤ 70 % del de 6 m/s', M[2].largo > 0 && M[2].largo <= 0.7 * M[6].largo, { a2: M[2].largo, a6: M[6].largo });
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado/i.test(x));
const OT = {}; for (const [k, a] of [['diagonal', Math.PI / 4], ['costado', Math.PI / 2], ['atrás', Math.PI], ['atrás en diagonal', -3 * Math.PI / 4]]) OT[k] = await medir(2, a);
OT.agachado = await medir(1, 0, true);
ok('4. en diagonal, de costado y para atrás (2 m/s) y agachado (1 m/s): promedio ≤ 0,4', Object.values(OT).every((m) => m.patinado <= 0.4), OT);
ok('5. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
