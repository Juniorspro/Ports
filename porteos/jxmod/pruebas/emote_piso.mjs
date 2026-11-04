// emotes y la cámara en primera persona: en los que bajan la cabeza al piso (Breakdance) la cámara pasa sola a tercera
// persona y nunca queda debajo del suelo; en los de parado (YMCA, Gangnam) sigue en primera, con los ojos en la cabeza.
// Y ningún hueso del cuerpo queda debajo del piso. Se mira cada 0,25 s durante 9 s, en el celular. uso: node emote_piso.mjs URL_HTML
import { abrir } from './base.mjs';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(process.argv[2], true);
await ev(`PREFS.bienvenida = true; inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(3000);
for (const [e, piso] of [['rb:Breakdance', true], ['rb:YMCA', false], ['rb:Gangnam', false]]) {
  await ev(`JUG.tercera = false; JUG.pitch = -0.2; JUG.cuerpo.emote = null; 1`); await p.waitForTimeout(800);
  await ev(`emote('${e}'); 1`);
  const L = [];
  for (let i = 0; i < 36; i++) {
    await p.waitForTimeout(250);
    L.push(await ev(`(() => { const P = JUG.cuerpo, W = P.md.W[P.D.h.Head], suelo = JUG.pos.y - 0.95; return { bajo: +(CAM.pos.y - suelo).toFixed(2), aCabeza: +Math.hypot(CAM.pos.x - W[12], CAM.pos.y - W[13], CAM.pos.z - W[14]).toFixed(2), cabeza: +(W[13] - suelo).toFixed(2), k3: +(JUG.emo3K || 0).toFixed(2), emo: P.emote, cuerpo: +(Math.min(...(P.D._bajoCadera || []).map((k) => P.md.W[k][13])) - P.md.raiz[13]).toFixed(2) }; })()`));
    if (i === 20) await p.screenshot({ path: 'emote_' + e.slice(3) + '.png' });
  }
  const minCuerpo = Math.min(...L.filter((x) => x.emo).map((x) => x.cuerpo));
  ok(`${e}: ningún hueso del cuerpo queda debajo del piso (mín ${minCuerpo} m)`, minCuerpo > -0.05, { minCuerpo });
  const minAlto = Math.min(...L.map((x) => x.bajo)), bajaCab = L.filter((x) => x.cabeza < 0.9), enTercera = bajaCab.filter((x) => x.aCabeza > 1);
  if (piso) {
    ok(`${e}: la cámara nunca queda debajo del piso (mín ${minAlto} m)`, minAlto > 0.25, { minAlto });
    ok(`${e}: con la cabeza en el piso, la cámara en tercera persona`, bajaCab.length > 0 && enTercera.length >= bajaCab.length * 0.8, { cuadrosCabezaAbajo: bajaCab.length, enTercera: enTercera.length });
  } else {
    const fp = L.filter((x) => x.emo && x.aCabeza < 0.4).length;
    ok(`${e}: de parado sigue en primera persona (ojos en la cabeza)`, fp >= L.filter((x) => x.emo).length * 0.8 && minAlto > 0.25, { primera: fp, de: L.filter((x) => x.emo).length, minAlto });
  }
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
