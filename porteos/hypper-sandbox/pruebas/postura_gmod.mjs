// la postura de GMod con cada arma, en todos los personajes: hacia dónde mira la cara (contra adonde miran los ojos del
// jugador de GMod en esa postura, sacado de male_anims.mdl con el punto "eyes" de male_02) y cuánto se mueven la mirada y
// el arma mientras corre la animación de quieto (la de mirar alrededor gira la cadera hasta 35°). Fotos de 3/4 del Hero
// uso: node postura_gmod.mjs HTML CARPETA
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 13; DIA.aplicada = -1; 1`);
await p.waitForTimeout(3000);
await ev(`$('hud').classList.add('oc'); JUG.noclip = true; JUG.tercera = false; ARM.v = null; 1`);
// GMod: grados bajo el horizonte de la mirada en cada postura quieta
const GM = { gm_idle_melee: 9.4, gm_idle_pistol: -1.8, gm_idle_gravgun: 13.1, gm_idle_smg1: 20.5, gm_idle_ar2: 20.5, gm_idle_shotgun: 20.5, gm_idle_crossbow: 13.1, gm_idle_rpg: 11.4 };
const ARMAS = { gm_idle_melee: 'Crowbar', gm_idle_pistol: 'Pistol', gm_idle_gravgun: 'GravityGun', gm_idle_smg1: 'Smg', gm_idle_ar2: 'Akm', gm_idle_shotgun: 'Shotgun', gm_idle_crossbow: 'Crossbow', gm_idle_rpg: 'RPG' };
const skins = await ev(`DATA.chars.slice()`);
const tabla = {};
for (const s of skins) {
  tabla[s] = await ev(`(() => {
    const P = crearPersona('${s}', 'HatEmpty', { nombre: '' }); P.npc = true; P.pos.set(0, 10, 0); P.yaw = 0; P.vel.set(0, 0, 0); P.suelo = true;
    const ix = huesosMixamo(P.D), md = P.md, iH = ix.Head;
    if (iH === undefined || !P.hum || !P.D.rw || !P.D.rw[iH]) { borrarPersona(P); return null; }
    // la cara: el adelante del personaje en reposo (mira a +Z) llevado por el giro de la cabeza respecto del reposo
    const cara = () => { const f = m4quat(md.W[iH]).norm().mul(P.D.rw[iH].conj()).norm().rot(v3(0, 0, 1));
      return [Math.atan2(-f.y, Math.hypot(f.x, f.z)) * 180 / Math.PI, Math.atan2(f.x, f.z) * 180 / Math.PI]; };
    const J = (n) => { const w = md.W[ix[n]]; return w ? [w[12], w[13], w[14]] : null; };
    const out = {};
    for (const [pose, arma] of Object.entries(${JSON.stringify(ARMAS)})) {
      if (!humClipNombre('Pose', pose)) continue;
      P.arma = arma; P.poseForzada = pose; P.mira = 0; P.hum.t = 0; P.hum.listo = false;
      const abajo = [], lado = [], arm = [];
      // una vuelta entera de la animación de quieto (9,6 s), cada 1/3 s
      for (let i = 0; i < 300; i++) { animarPersona(P, 1 / 30); if (i < 15 || i % 10) continue; ubicarPersona(P); md.sucio = true; md.actualizar();
        const [a, y] = cara(); abajo.push(a); lado.push(y);
        const c = J('Spine2'), m = J('RightHand'); if (c && m) arm.push(Math.atan2(m[0] - c[0], m[2] - c[2]) * 180 / Math.PI); }
      const med = (v) => v.reduce((x, y) => x + y, 0) / v.length, rg = (v) => Math.max(...v) - Math.min(...v);
      out[pose] = { abajo: +med(abajo).toFixed(1), rangoMira: +Math.max(rg(abajo), rg(lado)).toFixed(1), rangoArma: +rg(arm).toFixed(1) };
    }
    P.poseForzada = null; borrarPersona(P); return out; })()`);
}
// criterios: la cara mira como en GMod (±5°, ±8° en los personajes que no son humanos de Mixamo), no se balancea más de 6°
// ni el arma más de 14° en toda la vuelta
const peor = { mira: [0, ''], rangoMira: [0, ''], rangoArma: [0, ''] };
for (const [s, t] of Object.entries(tabla)) {
  if (!t) continue;
  for (const [pose, x] of Object.entries(t)) {
    const d = Math.abs(x.abajo - GM[pose]);
    if (d > peor.mira[0]) peor.mira = [+d.toFixed(1), s + ' ' + pose];
    if (x.rangoMira > peor.rangoMira[0]) peor.rangoMira = [x.rangoMira, s + ' ' + pose];
    if (x.rangoArma > peor.rangoArma[0]) peor.rangoArma = [x.rangoArma, s + ' ' + pose];
  }
}
const hero = tabla.Hero;
ok('Hero: la cara mira como en GMod en las 8 posturas (±4°)', hero && Object.entries(hero).every(([k, x]) => Math.abs(x.abajo - GM[k]) <= 4), hero);
const malos = Object.entries(tabla).filter(([s, t]) => t && Object.entries(t).some(([k, x]) => Math.abs(x.abajo - GM[k]) > 8)).map(([s, t]) => [s, Object.fromEntries(Object.entries(t).map(([k, x]) => [k.replace('gm_idle_', ''), x.abajo]))]);
ok('todos los personajes: la cara a menos de 8° de GMod', !malos.length, { peor: peor.mira, fuera: malos.slice(0, 6) });
ok('la mirada no se balancea más de 6° con la animación de quieto', peor.rangoMira[0] <= 6, peor.rangoMira);
ok('el arma no se balancea más de 14°', peor.rangoArma[0] <= 14, peor.rangoArma);
// fotos de 3/4 del Hero con cada arma (la cámara de pruebas)
for (const [pose, arma] of Object.entries(ARMAS)) {
  await ev(`(() => { if (window.__P) borrarPersona(window.__P); const P = window.__P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.npc = true; P.arma = '${arma}'; P.mira = 0;
    P.pos.set(JUG.pos.x + Math.sin(JUG.yaw) * 3, JUG.pos.y, JUG.pos.z + Math.cos(JUG.yaw) * 3); P.yaw = 0; P.vel.set(0, 0, 0); P.suelo = true;
    for (let i = 0; i < 40; i++) animarPersona(P, 1 / 30); ubicarPersona(P); P.md.sucio = true; P.md.actualizar();
    const c = P.pos, q0 = v3(c.x + 2.1, c.y + 0.35, c.z + 2.1), t = v3(c.x, c.y + 0.2, c.z), f = vsub(t, q0).norm(); let q = Quat.euler(Math.atan2(f.x, f.z), Math.asin(f.y));
    if (q.rot(v3(0, 0, 1)).distTo(f) > 0.01) q = Quat.euler(Math.atan2(f.x, f.z), -Math.asin(f.y)); DBG.cam = { p: q0, q }; return 1; })()`);
  await p.waitForTimeout(300); await p.screenshot({ path: D + 'postura_' + arma + '.jpg', type: 'jpeg', quality: 80 });
}
ok('sin errores', !err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).length, err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
