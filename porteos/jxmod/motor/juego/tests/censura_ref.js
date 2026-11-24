// la censura de la web (juego/censura.js) con una lista de mensajes: lo que tapa, para comparar con juego/src/censura.rs
// uso: node juego/tests/censura_ref.js > juego/tests/datos/censura.json
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../../../juego/censura.js'), 'utf8').split('// ---------------- la IA')[0];
const ctx = { reU: (s, f) => new RegExp(s, f) }; vm.createContext(ctx);
vm.runInContext(src + '\nthis.censurar = censurar;', ctx);
const M = ['hola che', 'sos un puuuto', 'sh1t', 'p.u.t.a', 'f-u-c-k you', 'me compré una tanga', 'kill yourself', 'KILL YOUR SELF', 'k i l l yourself',
  'mi mail es juan.perez+x@gmail.com dale', 'llamame al 11 2345-6789', 'el año 2026 y 100000000', '(011) 4567 8901', 'jajaja que pelotudo', 'Pelotudoooos',
  'hijueputa', 'ctm wey', 'concha de tu madre', 'la concha de la lora', 'tu vieja en tanga', 'cazo de sopa', 'ser hoe', 'sexy', 'Sexo', 'xxx', 'XXXL',
  'idiota', 'estúpido', 'ESTÚPIDA', 'p u t o', 'm i e r d a', 'mi3rd4', 'what the fuuuuck', 'fuck', 'fucking', 'scheiße', 'сука блять', 'caralho mano',
  'é foda', 'nada que ver', 'putamadre', 'computadora', 'disputa', 'reputación', 'b1tch', '$hit', 'a$$hole', '@sshole', 'gg wp', 'pene', 'penélope',
  'te voy a violar', 'matate', 'kys', 'nos vemos 12/12/2025', 'código 12345678', 'tel +54 9 11 2222 3333'];
console.log(JSON.stringify(M.map((m) => [m, ctx.censurar(m)])));
