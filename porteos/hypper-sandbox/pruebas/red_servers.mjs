// servers que crean los jugadores: quedan en la lista aunque estén vacíos (0/∞), sólo el dueño los borra (y los de
// adentro vuelven al menú) y a los 10 minutos sin nadie se borran solos. Usa la tienda real (borra todo al final).
// Para probar el borrado solo sin esperar 10 minutos: CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en el entorno y
// WRANGLER = ruta a wrangler (adelanta el reloj de ese server en la base).
import { createRequire } from 'module'; import http from 'http'; import { execFileSync } from 'child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json');
const html = process.argv[2], D = (process.argv[3] || '.') + '/', API = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const navs = [], errs = [], creados = [];
const abrir = async (n) => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('dialog', (d) => d.accept());
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8897/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (b, t, x) => console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : ''));
// la fila de un server en la lista de alguien
const fila = (P, nom) => ev(P, `(() => { SALAS_REG.t = 0; listaDibujar(); const f = [...document.querySelectorAll('.sala')].find((d) => d.querySelector('.salaN').textContent.startsWith(${JSON.stringify(nom)})); return f ? JSON.stringify({ n: f.querySelector('.salaN').textContent, j: f.querySelector('.salaJ').textContent, d: f.querySelector('.salaD').textContent, borrar: !!f.querySelector('.salaX') }) : 'null'; })()`).then(JSON.parse);
const aLista = (P) => ev(P, `(() => { inicioMostrar(false); conectarMultijugador(); setTimeout(() => subMp('ServerList'), 300); return 1; })()`);
try {
  const A = await abrir('A'), B = await abrir('B');
  for (const [P, n] of [[A, 'Ana'], [B, 'Beto']]) await ev(P, `PREFS.nombre='${n}'; PREFS.bienvenida=true; PREFS.lang='es'; PREFS.modsSrv = {}; PREFS.mods = {}; localStorage.removeItem('rb_salas_mias'); 1`);
  await aLista(A); await aLista(B); await espera(5000);
  // Ana crea un server (sin clave) y entra
  await ev(A, `(async () => { subMp('ServerCreate'); MENU.ent.ServerNameFieldNew.value = 'Prueba Ana'; MENU.ent.Password.value = ''; PREFS.mapa = 'City'; await crearServidor(); return 1; })()`);
  await espera(9000);
  const sa = JSON.parse(await ev(A, `JSON.stringify({ id: SALA && SALA.id, rg: SALA && SALA.rg, estado: JUEGO.estado, mia: !!salasMias()[SALA && SALA.id], arriba: $('redEst').textContent })`)); creados.push(sa.id);
  ok(sa.rg === 1 && sa.mia && sa.estado === 'juego', 'Ana creó el server (guardado en la tienda, es suyo) y está adentro', sa);
  ok(/∞/.test(sa.arriba), 'arriba dice sin límite', sa.arriba);
  let f = await fila(B, 'Prueba Ana'); await espera(1500); f = await fila(B, 'Prueba Ana');
  ok(f && f.j.trim() === '1/∞' && !f.borrar, 'Beto lo ve con 1/∞ y sin botón de borrar (no es suyo)', f);
  await B.screenshot({ path: D + 's1_lista_beto.png' });
  // Ana sale: queda vacío en la lista, con la cuenta de los 10 minutos
  await ev(A, `irMenuPrincipal(); 1`); await espera(1500); await aLista(A); await espera(4000);
  f = await fila(B, 'Prueba Ana'); await espera(1500); f = await fila(B, 'Prueba Ana');
  ok(f && f.j.trim() === '0/∞' && /se borra en 1?\d min/.test(f.d), 'vacío sigue en la lista: 0/∞ y "se borra en … min"', f);
  const fa = await fila(A, 'Prueba Ana');
  ok(fa && fa.borrar && /tuyo/.test(fa.n), 'Ana lo ve como suyo, con botón de borrar', fa);
  await A.screenshot({ path: D + 's2_lista_ana.png' });
  // a los 10 minutos sin nadie se borra solo (se adelanta su reloj en la base)
  if (process.env.WRANGLER && process.env.CLOUDFLARE_API_TOKEN) {
    execFileSync(process.env.WRANGLER, ['d1', 'execute', 'rezobox-tienda', '--remote', '--command', `UPDATE salas SET vivo = vivo - 601000 WHERE id = '${sa.id}'`], { cwd: process.env.TIENDA_DIR || '.', stdio: 'ignore', timeout: 90000 });
    f = await fila(B, 'Prueba Ana'); await espera(2500); f = await fila(B, 'Prueba Ana');
    ok(f === null, 'a los 10 minutos vacío se borró solo (Beto ya no lo ve)', f);
    const r = await (await fetch(API + 'salas')).json(); ok(!r.salas.some((x) => x.id === sa.id), 'y la tienda ya no lo tiene');
  } else console.log('(sin credenciales: no se prueba el borrado a los 10 minutos)');
  // Ana crea otro con clave; Beto entra con la clave; Ana sale y lo borra desde la lista: Beto vuelve al menú
  await ev(A, `(async () => { subMp('ServerCreate'); MENU.ent.ServerNameFieldNew.value = 'Clave Ana'; MENU.ent.Password.value = '1234'; PREFS.mapa = 'FlatGrass'; await crearServidor(); return 1; })()`);
  await espera(8000);
  const s2 = JSON.parse(await ev(A, `JSON.stringify({ id: SALA.id, rg: SALA.rg, pw: SALA.pw, ph: SALA.ph })`)); creados.push(s2.id);
  ok(s2.rg === 1 && s2.pw === 1, 'Ana creó un server con clave', s2);
  await ev(A, `irMenuPrincipal(); 1`); await espera(1000);
  // Ana vuelve a entrar sin escribir la clave (es suya)
  await aLista(A); await espera(3500);
  await ev(A, `(() => { const e = listaSalas().find((x) => x.S.id === '${s2.id}'); entrarSala(e.S); return 1; })()`); await espera(6000);
  ok(await ev(A, `JUEGO.estado === 'juego' && SALA && SALA.id === '${s2.id}'`), 'la dueña entra a su server con clave sin escribirla');
  ok(await ev(A, `soyAnfitrion()`), 'y es la anfitriona');
  await ev(A, `irMenuPrincipal(); 1`); await espera(1000);
  // Beto entra con la clave buena (antes refresca su lista)
  await fila(B, 'Clave Ana'); await espera(2500);
  console.log('  Beto busca el server:', await ev(B, `(() => { const e = listaSalas().find((x) => x.S.id === '${s2.id}'); if (!e) return 0; if (hashTxt('c' + e.S.id + '1234') !== e.S.ph) return -1; entrarSala(e.S, '1234'); return 1; })()`));
  await espera(7000);
  ok(await ev(B, `JUEGO.estado === 'juego' && SALA && SALA.id === '${s2.id}'`), 'Beto entró con la clave');
  await aLista(A); await espera(4000);
  const fb = await fila(A, 'Clave Ana'); ok(fb && fb.j.trim() === '1/∞', 'Ana ve a Beto adentro', fb);
  await ev(A, `(() => { const f = [...document.querySelectorAll('.sala')].find((d) => d.querySelector('.salaN').textContent.startsWith('Clave Ana')); f.querySelector('.salaX').click(); return 1; })()`);
  await espera(9000);
  ok(await ev(B, `JUEGO.estado !== 'juego'`), 'Ana lo borró: Beto volvió al menú', await ev(B, `JUEGO.estado + ' · ' + (document.querySelector('.menuAviso, #menuAviso') ? document.querySelector('.menuAviso, #menuAviso').textContent : '')`));
  const r2 = await (await fetch(API + 'salas')).json(); ok(!r2.salas.some((x) => x.id === s2.id), 'la tienda ya no lo tiene');
  await B.screenshot({ path: D + 's3_beto_afuera.png' });
} catch (e) { console.log('ERROR', e.message); }
// limpieza: lo que haya quedado
for (const id of creados) { try { const A = navs[0] && (await navs[0].contexts()[0].pages()[0]); const c = await A.evaluate((id) => (JSON.parse(localStorage.getItem('rb_salas_mias') || '{}')[id] || {}).clave, id); if (c) await fetch(API + 'salas/' + id + '/borrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: c }) }); } catch (e) {} }
console.log('errores:', errs.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
for (const b of navs) await b.close(); srv.close(); process.exit(0);
