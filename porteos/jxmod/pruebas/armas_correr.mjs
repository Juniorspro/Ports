// Armas de mods al correr (Discord, noviembre de 2026: «Todas las armas se bugearon» —la AK-47 fuera de lugar— y «las manos
// se me elevaron, yo por accidente lo provoqué» —los puños de M9K arriba—). La causa: en el celular, soltar la palanca
// corriendo (el dedo al tope) dejaba ENT.correr prendido para siempre, el Lua veía IN_SPEED apretado y las armas de M9K
// quedaban en «corriendo»; y como su Think corre sólo del lado del servidor, la vista (del cliente) dibujaba eso con la mira
// puesta (la AK) o con la guardia arriba (los puños). Con M9K Assault Rifles (128089118) y M9K Specialties (144982052):
//  1. AK-47 con Shift: la pose de correr de M9K (el caño girado ≥ 25° al costado), no la de la mira (centrada);
//  2. al soltar Shift vuelve a su lugar (≤ 1 cm y ≤ 1°);
//  3. puños con Shift: bajan (pose de correr, girados hacia abajo), no la guardia; al soltar, vuelven;
//  4. puños con R (la guardia de verdad): suben; al soltar, bajan;
//  5. palanca táctil al tope y soltada: corre mientras está al tope, pero el Lua no ve IN_SPEED, y al soltar ENT.correr se apaga;
//  6. soltar Shift con un menú abierto (el Think del arma no corre): al cerrar, el arma vuelve a su lugar igual;
//  7. mirando al piso (pitch 1,1) cada pose queda igual respecto de la cámara que mirando al frente (≤ 1 cm);
//  8. sin errores de Lua ni de JS.
// uso: node armas_correr.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, G, FOTOS] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 30000 ? ok() : setTimeout(f, 20)); f(); }); 1`);
for (const id of ['128089118', '144982052']) await ev(`(async () => { const A = await gmInstalar('${id}', { nombre: '${id}' }, new Uint8Array(await (await fetch('${G}/${id}.gma')).arrayBuffer())); await A.listo; return 1; })()`);
const espera = (s) => ev(`esperaJuego(${s}).then(() => 1)`);
// la vista en el espacio de la cámara: dónde está su raíz y hacia dónde apunta su eje adelante (ángulo con la mirada)
const vista = async () => ev(`(() => { const v = ARM.v; if (!v || !v.md) return null; v.md.actualizar(); const m = v.md.raiz, qi = CAM.q.clone().conj(); const d = qi.rot(v3(m[12] - CAM.pos.x, m[13] - CAM.pos.y, m[14] - CAM.pos.z)), z = qi.rot(v3(m[8], m[9], m[10]).norm());
  return { p: [d.x, d.y, d.z], z: [z.x, z.y, z.z], ang: Math.acos(Math.max(-1, Math.min(1, z.z))) * 180 / Math.PI, abajo: Math.asin(Math.max(-1, Math.min(1, -z.y))) * 180 / Math.PI }; })()`);
const dist = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
const angEntre = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.z[0] * b.z[0] + a.z[1] * b.z[1] + a.z[2] * b.z[2]))) * 180 / Math.PI;
const r = (o) => o && { p: o.p.map((x) => +x.toFixed(3)), ang: +o.ang.toFixed(1), abajo: +o.abajo.toFixed(1) };
const foto = async (n) => { if (FOTOS) await p.screenshot({ path: FOTOS + '/' + n + '.png' }); };

// ---- AK-47 ----
await ev(`(async () => { gmaSpawnMenu('gmswep:m9k_ak47'); JUG.pitch = 0; await esperaJuego(2); return 1; })()`);
const ak0 = await vista();
await ev(`ENT.disparo2 = true; 1`); await espera(1); const akMira = await vista(); await ev(`ENT.disparo2 = false; 1`); await espera(1);
await ev(`ENT.teclas.add('ShiftLeft'); 1`); await espera(1); const akCorre = await vista(); await foto('ak_corre');
await ev(`JUG.pitch = 1.1; 1`); await espera(0.5); const akCorreAbajo = await vista(); await ev(`JUG.pitch = 0; 1`);
await ev(`ENT.teclas.delete('ShiftLeft'); 1`); await espera(1); const akSuelta = await vista();
ok('1. AK-47 con Shift: pose de correr (caño girado ≥ 25°), no la de la mira', akCorre && angEntre(akCorre, ak0) >= 25 && dist(akCorre, akMira) > 0.02, { quieta: r(ak0), mira: r(akMira), corre: r(akCorre), giro: +angEntre(akCorre, ak0).toFixed(1) });
ok('2. AK-47: al soltar Shift vuelve a su lugar (≤ 1 cm, ≤ 1°)', akSuelta && dist(akSuelta, ak0) <= 0.01 && angEntre(akSuelta, ak0) <= 1, r(akSuelta));
// ---- puños ----
await ev(`(async () => { gmaSpawnMenu('gmswep:m9k_fists'); JUG.pitch = 0; await esperaJuego(2); return 1; })()`);
const pu0 = await vista();
await ev(`ENT.teclas.add('ShiftLeft'); 1`); await espera(1); const puCorre = await vista(); await foto('punos_corre');
await ev(`ENT.teclas.delete('ShiftLeft'); 1`); await espera(1); const puSuelta = await vista();
await ev(`ENT.teclas.add('KeyR'); 1`); await espera(1); const puGuardia = await vista(); await foto('punos_guardia');
await ev(`JUG.pitch = 1.1; 1`); await espera(0.5); const puGuardiaAbajo = await vista(); await ev(`JUG.pitch = 0; 1`);
await ev(`ENT.teclas.delete('KeyR'); 1`); await espera(1); const puSuelta2 = await vista();
ok('3. puños con Shift: bajan (pose de correr, ≥ 10° hacia abajo), no la guardia; al soltar vuelven', puCorre && puCorre.abajo - pu0.abajo >= 10 && dist(puSuelta, pu0) <= 0.01, { quietos: r(pu0), corren: r(puCorre), soltó: r(puSuelta) });
ok('4. puños con R: la guardia sube (≥ 10° hacia arriba); al soltar R bajan (≤ 1 cm)', puGuardia && pu0.abajo - puGuardia.abajo >= 10 && dist(puSuelta2, pu0) <= 0.01, { guardia: r(puGuardia), soltó: r(puSuelta2) });
// ---- la palanca táctil, con toques de verdad (CDP) ----
const cdp = await p.context().newCDPSession(p);
const box = await ev(`(() => { const z = document.getElementById('toque').getBoundingClientRect(); return { x: z.left, y: z.top, w: z.width, h: z.height }; })()`);
const x0 = box.x + box.w * 0.15, y0 = box.y + box.h * 0.7;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - i * 15, id: 1 }] }); await p.waitForTimeout(40); }
await espera(0.5);
const enBorde = await ev(`({ correr: !!ENT.correr, palanca: !!ENT.correrPalanca, speed: !!(gmaTeclas() & 131072), y: +ENT.y.toFixed(2) })`);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await espera(0.3);
const soltada = await ev(`({ correr: !!ENT.correr, speed: !!(gmaTeclas() & 131072), y: ENT.y })`);
const puPal = await vista();
ok('5. palanca al tope: corre pero el Lua no ve IN_SPEED; al soltarla deja de correr', enBorde.correr && !enBorde.speed && !soltada.correr && !soltada.speed && dist(puPal, pu0) <= 0.01, { enBorde, soltada });
// ---- soltar con un menú abierto ----
await ev(`ENT.teclas.add('ShiftLeft'); 1`); await espera(1);
await ev(`(() => { UI.abierto = true; ENT.teclas.delete('ShiftLeft'); return 1; })()`); await p.waitForTimeout(600);
await ev(`(() => { UI.abierto = false; return 1; })()`); await espera(1);
const puMenu = await vista();
ok('6. soltar Shift con un menú abierto: al cerrarlo los puños vuelven a su lugar', puMenu && dist(puMenu, pu0) <= 0.01, r(puMenu));
ok('7. mirando al piso, cada pose queda igual respecto de la cámara (≤ 1 cm)', akCorreAbajo && dist(akCorreAbajo, akCorre) <= 0.01 && dist(puGuardiaAbajo, puGuardia) <= 0.01, { ak: +dist(akCorreAbajo, akCorre).toFixed(4), puños: +dist(puGuardiaAbajo, puGuardia).toFixed(4) });
const errLua = await ev(`GMA.errores.slice(-5)`);
ok('8. sin errores de Lua ni de JS', !errLua.length && !err.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::/i.test(x)).length, { lua: errLua, js: err.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::/i.test(x)).slice(0, 3) });
await b.close();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
