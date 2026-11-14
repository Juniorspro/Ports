// Código que un comentario de fin de línea se «come»: en la 3.2, «// (sin lo que tardan los caminos de los nextbots…)»
// quedó en la misma línea que FrameTime, RealFrameTime, FrameNumber y VGUIFrameTime, que dejaron de existir para el Lua de
// los mods (cada arma que suaviza algo con FrameTime() —FA:S, TFA, ArcCW, CW 2.0, los sables— tiraba error en cada cuadro).
// Igual con Player:Give/HasWeapon/StripWeapon, Entity:SetKeyValue, PhysObj:IsMotionEnabled… desde la 2.9.
// Busca en juego/*.js las líneas con «// (…)» seguido de más código (una llamada o una asignación que termina en «;»).
// uso: node codigo_tragado.mjs   (sale con error si encuentra alguna)
import fs from 'fs'; import path from 'path';
const J = path.join(path.dirname(new URL(import.meta.url).pathname), '../juego');
const hallados = [];
for (const f of fs.readdirSync(J).filter((x) => x.endsWith('.js'))) {
  fs.readFileSync(path.join(J, f), 'utf8').split('\n').forEach((l, n) => {
    // (el primer «//» que no está adentro de un texto ni es el cierre de una expresión regular)
    let i = l.indexOf('//');
    while (i >= 0) {
      const pre = l.slice(0, i), cuenta = (c) => pre.split(c).length - 1;
      if (cuenta("'") % 2 === 0 && cuenta('"') % 2 === 0 && cuenta('`') % 2 === 0 && !/[:=(,|!]\s*$/.test(pre) && !/\/[^/\s]*$/.test(pre.trimEnd().slice(-1) === '/' ? pre : '') && pre.trim()) break;
      i = l.indexOf('//', i + 2);
    }
    if (i < 0) return;
    const c = l.slice(i);
    // («// (…)» y después código: algo como «X(…);», «x = …;», «if (…) …;»)
    const m = /^\/\/\s*\((?:[^()]|\([^()]*\))*\)\s+(.*)$/.exec(c);
    if (!m) return;
    const resto = m[1];
    if (/^(?:[A-Za-z_$][\w.$]*\s*(?:\(|=[^=])|if \(|for \(|const |let |return\b)/.test(resto) && /;\s*(?:\/\/.*)?$|\)\s*;|\}\s*$/.test(resto)) hallados.push(`${f}:${n + 1}: ${resto.slice(0, 140)}`);
  });
}
for (const h of hallados) console.log('TRAGADO ' + h);
console.log(hallados.length ? `${hallados.length} líneas con código después de un comentario` : 'OK: ningún código queda adentro de un comentario');
process.exit(hallados.length ? 1 : 0);
