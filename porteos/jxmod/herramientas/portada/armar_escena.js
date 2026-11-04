// (se evalúa en la página) arma la escena de la portada alrededor de C
(() => {
  const C = v3(0.5, 0, 14); C.y = pisoBajo(v3(C.x, 30, C.z), 0) || 0.53; window.__C = C;
  DIA.ciclo = false; DIA.hora = 17.0; DIA.aplicada = -1; GFX.auto = false; GFX.escala = 1; GFX.escalaMax = 1;
  $('hud').classList.add('oc'); JUG.noclip = false; JUG.pos.set(C.x, C.y + 1, C.z); JUG.vel.set(0, 0, 0); JUG.yaw = -1.25; JUG.pitch = 0; JUG.tercera = true;
  entidadPonerMod('radio', true); radioEspalda(radioMia(), true);
  for (const e of ENTS.lista.filter((x) => x.t === 'piano')) entidadQuitar(e);
  const suelo = (x, z) => pisoBajo(v3(x, 30, z), 0) || C.y;
  const obj = (n, x, z, yaw, alto) => { const o = crearObjeto(n, v3(x, suelo(x, z) + (alto || 1), z), Quat.axis(0, 1, 0, yaw)); if (o) { o.b.frozen = false; o.b.wake(); } return o; };
  obj('police_car_v5', C.x + 5.2, C.z - 2.5, 0.5, 1.2); obj('Sofie', C.x - 5.6, C.z - 3.2, -0.45, 1.2); obj('Moto', C.x + 3.4, C.z + 2.6, 2.4, 1);
  obj('Barrel', C.x - 3.6, C.z + 1.6, 0); obj('Crate', C.x - 4.4, C.z + 2.4, 0.4); obj('Crate', C.x - 4.1, C.z + 2.2, 0.2, 2.2); obj('Barrel', C.x + 6.8, C.z + 1.2, 0);
  window.__gente = [['Soldier', 'Techno', -2.1, -2.0, 0.25], ['PilotFemale', 'Victory', 2.2, -1.8, -0.2], ['Engineer', 'ChickenDance', -3.3, 0.2, 0.5], ['Jean', 'Clap', 3.2, 0.1, -0.45]]
    .map(([s, em, x, z, yaw]) => { const P = crearPersona(s, 'HatEmpty', { nombre: '' }); P.pos.set(C.x + x, suelo(C.x + x, C.z + z) + 1, C.z + z); P.yaw = yaw; P.emote = em; P.emoteT = Math.random() * 2; P.suelo = true; return P; });
  emote('FightIdle');
  return 1;
})()
