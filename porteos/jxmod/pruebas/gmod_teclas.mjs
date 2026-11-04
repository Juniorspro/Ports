// las teclas que miran los addons: input.IsKeyDown(KEY_*) y los hooks PlayerButtonDown/PlayerButtonUp (con el número de
// KEY_/MOUSE_ de GMod) andan con el teclado, con los botones que el mod agrega a la pantalla y con el secundario.
// uso: node gmod_teclas.mjs URL_HTML
import { abrir } from './base.mjs';
const { b, p, ev } = await abrir(process.argv[2], false);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
const r = await ev(`(async () => { const esp = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 20000 ? ok() : setTimeout(f, 20)); f(); });
  if (!GMA.R) await gmaIniciar(); GMA.activo = true; const L = (c) => { const x = gmaCorrer('t.lua', c); return x === undefined ? x : String(x); };
  L('TB = {} hook.Add("PlayerButtonDown", "t", function(p, b) TB[#TB + 1] = "d" .. b end) hook.Add("PlayerButtonUp", "t", function(p, b) TB[#TB + 1] = "u" .. b end) return 1');
  ENT.teclas.add('KeyG'); await esp(0.2); const g = L('return tostring(input.IsKeyDown(KEY_G)) .. " " .. tostring(input.IsKeyDown(KEY_H))'); ENT.teclas.delete('KeyG'); await esp(0.2);
  CTL.teclasMod.add('KeyF'); await esp(0.2); const f = L('return tostring(input.IsKeyDown(KEY_F))'); CTL.teclasMod.delete('KeyF'); await esp(0.2);
  ENT.disparo2 = true; await esp(0.2); ENT.disparo2 = false; await esp(0.2);
  return { g, f, ev: L('local s = "" for _, v in ipairs(TB) do s = s .. v .. "," end return s'), errs: GMA.errores.slice(0, 3) }; })()`);
ok('input.IsKeyDown(KEY_G) con la tecla G (y no la H)', r.g === 'true false', r.g);
ok('input.IsKeyDown(KEY_F) con el botón del mod en la pantalla', r.f === 'true', r.f);
ok('PlayerButtonDown/Up con G, F (botón del mod) y el secundario (MOUSE_RIGHT)', r.ev === 'd17,u17,d16,u16,d108,u108,', r.ev);
ok('sin errores de Lua', !r.errs.length, r.errs);
console.log(R.every(Boolean) ? 'TODO BIEN ' + R.length + '/' + R.length : 'FALLAN ' + R.filter((x) => !x).length + '/' + R.length);
await b.close();
