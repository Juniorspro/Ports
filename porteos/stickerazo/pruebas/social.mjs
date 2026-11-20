// La comunidad punta a punta, con dos personas en dos celulares (toques de verdad) y el servidor de verdad (sobre SQLite):
// @juancito entra, agrega un pack listo y lo publica; @maria.sol lo ve en el feed, le da me gusta con doble toque, lo
// abre, lo sigue, lo baja, lo busca, mira su perfil, lo denuncia y lo bloquea; un tercero lo abre por el enlace; sin
// conexión la app sigue andando; @juancito edita su perfil y borra su cuenta.
// uso: node social.mjs [SALIDA=/tmp/claude-0/sz_social]
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http'; import { arrancar } from './servidor_local.mjs';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const [, , SAL = '/tmp/claude-0/sz_social'] = process.argv; fs.mkdirSync(SAL, { recursive: true }); for (const f of fs.readdirSync(SAL)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SAL, f));
const WEB = new URL('../web/', import.meta.url).pathname, PW = 8995, PC = 8996, API = `http://127.0.0.1:${PC}`;
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf' };
const web = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PW);
const { srv } = await arrancar(PC);
let fallas = 0, bien = 0; const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); c ? bien++ : fallas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const errores = [];
let nFoto = 0;
async function celular(nombre, api = API) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await ctx.newPage();
  await p.addInitScript((u) => { window.SZ_API = u; }, api);
  p.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/^INFO:|ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) errores.push(nombre + ' consola: ' + m.text().slice(0, 200)); });
  p.on('response', (q) => { if (q.status() >= 400) errores.push(`${nombre}: ${q.status()} ${q.url()}`); });
  const cdp = await ctx.newCDPSession(p);
  await p.goto(`http://127.0.0.1:${PW}/index.html`); await p.waitForFunction(() => window.__sz && document.fonts.status === 'loaded');
  const toque = async (sel, veces = 1) => { const bb = await p.locator(sel).first().boundingBox(), x = bb.x + bb.width / 2, y = bb.y + bb.height / 2; for (let i = 0; i < veces; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await espera(90); } };
  const foto = async (n) => { await espera(350); await p.screenshot({ path: path.join(SAL, `${String(++nFoto).padStart(2, '0')}_${n}.png`) }); };
  return { p, ctx, toque, foto, E: (f, a) => p.evaluate(f, a) };
}
const srvApi = async (ruta) => (await fetch(API + ruta)).json();

// ---------- @juancito: entra, agrega un pack listo y lo publica ----------
const A = await celular('A');
await A.p.click('#tabs [data-t="Perfil"]'); await A.p.waitForSelector('#regNombre'); await A.foto('bienvenida');
await A.p.fill('#regNombre', 'Juan Cito!'); ok((await A.p.inputValue('#regNombre')) === 'juancito', 'el @ se escribe solo en minúsculas y sin símbolos («Juan Cito!» → juancito)');
await A.p.click('#regEntrar'); await A.p.waitForSelector('#tabPerfil .arroba'); await A.foto('perfil_nuevo');
ok((await A.p.textContent('#tabPerfil .arroba')) === '@juancito' && (await A.E(() => JSON.parse(localStorage.sz_cuenta).nombre)) === 'juancito', 'registro: perfil de @juancito y la llave guardada en el celular');
await A.p.click('#tabs [data-t="Listos"]'); await A.p.click('#listos .listo[data-l="respuestas"]'); await A.p.click('#modal [data-x="1"]');
await A.p.waitForFunction(() => window.__sz.E.vista === 'vPack' && document.querySelector('#modal').classList.contains('oc'), null, { timeout: 60000 });
ok(/Publicar en la comunidad/.test(await A.p.textContent('#pPublicar')), 'en un pack propio aparece «Publicar en la comunidad»');
await A.p.click('#pPublicar'); await A.p.waitForSelector('#pbT'); await A.foto('publicar');
const tagsSug = await A.E(() => [...document.querySelectorAll('#pbT .chip')].map((b) => b.dataset.v + (b.classList.contains('act') ? '*' : '')));
await A.p.fill('#pbOtra', 'Respuestas!'); await A.p.press('#pbOtra', 'Enter');
await A.p.click('#modal [data-x="1"]'); await A.p.waitForSelector('#modal .grandote', { timeout: 30000 }); await A.foto('publicado');
ok(await A.p.isVisible('canvas.confeti'), `publicado con confeti (etiquetas sugeridas: ${tagsSug.join(' ')})`);
const loc = await A.E(() => { const E = window.__sz.E, p = E.packs.find((x) => x.id === E.packId); return p.publicado; });
await A.p.click('#modal [data-x="ver"]'); await A.p.waitForSelector('#puCont .puGrilla .st img'); await A.foto('pack_publico');
const pub = (await srvApi('/api/packs/' + loc.id)).pack;
ok(pub && pub.n === 10 && pub.autor.nombre === 'juancito' && pub.tags.includes('respuestas') && (await A.p.locator('#puCont .puGrilla .st').count()) === 10, `en el servidor: «${pub.nombre}» con ${pub.n} stickers, etiquetas ${pub.tags.join(' ')}`);
await A.p.click('#vPublico .volver'); await A.p.waitForFunction(() => window.__sz.E.vista === 'vPack');
ok(/Publicado ✓/.test(await A.p.textContent('#pPublicar')), 'de vuelta en el pack: «Publicado ✓ · Ver»');

// ---------- @maria.sol: lo ve en el feed, me gusta con doble toque, lo abre, sigue, baja, busca ----------
const B = await celular('B');
await B.p.waitForSelector('#feedLista .tf .tfGrilla img'); await B.foto('feed');
ok((await B.p.locator('#feedLista .tf:not(.esq)').count()) === 1 && /@juancito/.test(await B.p.textContent('#feedLista .tf:not(.esq)')), 'feed «Para vos»: el pack de @juancito');
await B.toque('#feedLista .tfGrilla', 2); await espera(300);
ok((await B.E(() => window.__sz.E.tab)) === 'Perfil', 'me gusta sin cuenta: te lleva a elegir tu @');
await B.p.fill('#regNombre', 'maria.sol'); await B.p.click('#regEntrar'); await B.p.waitForSelector('#tabPerfil .arroba');
await B.p.click('#tabs [data-t="Feed"]'); await B.p.waitForSelector('#feedLista .tf .tfGrilla img');
await B.toque('#feedLista .tfGrilla', 2); await espera(120);
ok(await B.p.isVisible('.boom'), 'doble toque: el corazón explota'); await B.foto('me_gusta');
await espera(900);
ok((await srvApi('/api/packs/' + loc.id)).pack.likes === 1 && /1/.test(await B.p.textContent('#feedLista [data-like] span')) && await B.p.isVisible('#feedLista .mg.si'), 'me gusta: 1 en el servidor y el corazón lleno');
await B.toque('#feedLista .tfGrilla', 1); await B.p.waitForSelector('#puCont .puGrilla .st img'); await espera(200);
ok((await B.E(() => window.__sz.E.vista)) === 'vPublico' && /Te gusta/.test(await B.p.textContent('#puLike')), 'un toque abre el pack (y dice «Te gusta»)');
await B.p.click('#puCont [data-seguir]'); await espera(500);
ok((await B.p.textContent('#puCont [data-seguir]')) === 'Siguiendo' && (await srvApi('/api/usuarios/juancito')).usuario.seguidores === 1, 'seguir a @juancito: 1 seguidor');
await B.p.click('#puWhats'); await B.p.waitForFunction(() => /Mis packs/.test(document.querySelector('#aviso').textContent), null, { timeout: 30000 });
const bajado = await B.E(() => window.__sz.E.packs.find((p) => p.origen));
ok(bajado && bajado.stickers.length === 10 && bajado.origen.autor === 'juancito' && bajado.autor === '@juancito', 'Agregar a WhatsApp (en el navegador): queda en Mis packs, con autor @juancito');
ok((await srvApi('/api/packs/' + loc.id)).pack.descargas === 1, 'cuenta 1 descarga');
await B.foto('pack_publico_B');
await B.p.click('#puCont .autor'); await B.p.waitForSelector('#usCont .arroba'); await B.foto('perfil_ajeno');
ok(/@juancito/.test(await B.p.textContent('#usCont .arroba')) && (await B.p.textContent('#usCont .segN')) === '1' && (await B.p.locator('#usCont .tf').count()) === 1, 'el perfil de @juancito: 1 seguidor y su pack');
await B.p.click('#vUsuario .volver'); await B.p.click('#vPublico .volver'); await B.p.waitForFunction(() => window.__sz.E.vista === 'vInicio');
ok((await B.E(() => window.__sz.E.tab)) === 'Feed', 'volver, volver: de nuevo en el feed');
await B.p.click('#feedSeg [data-m="siguiendo"]'); await B.p.waitForSelector('#feedLista .tf:not(.esq)'); ok((await B.p.locator('#feedLista .tf:not(.esq)').count()) === 1, '«Seguidos»: el pack de @juancito');
await B.p.click('#tabs [data-t="Mios"]'); await B.p.waitForSelector('#packs .packItem');
ok(/@juancito/.test(await B.p.textContent('#packs')), 'en Mis packs, con la insignia @juancito');
await B.p.click('#tabs [data-t="Listos"]'); await B.p.waitForSelector('#resCom .tendencias .chip');
const tend = await B.E(() => [...document.querySelectorAll('#resCom .tendencias .chip')].map((b) => b.dataset.tag));
ok(tend.includes('respuestas'), `Buscar: «Lo más picante» con las etiquetas de la comunidad (${tend.slice(0, 5).join(' ')}…)`);
await B.p.fill('#qBuscar', 'de una'); await B.p.waitForSelector('#resCom .tf:not(.esq)', { timeout: 10000 }); await B.foto('buscar_comunidad');
ok((await B.p.locator('#resCom .tf:not(.esq)').count()) === 1, 'buscar «de una» (lo que dice un sticker): encuentra el pack en la comunidad');
await B.p.fill('#qBuscar', '@juan'); await B.p.waitForSelector('#resCom .persona'); ok(/juancito/.test(await B.p.textContent('#resCom .persona')), 'buscar «@juan»: aparece @juancito');

// ---------- un tercero, sin la app abierta en el pack: el enlace ----------
const C = await celular('C');
await C.E((id) => window.__szAbrir('pack/' + id), loc.id); await C.p.waitForSelector('#puCont .puGrilla .st img');
ok((await C.E(() => window.__sz.E.vista)) === 'vPublico' && (await C.p.textContent('#puNombre')) === pub.nombre, 'el enlace stickerazo://pack/ID abre el pack');
const pagina = await (await fetch(`${API}/p/${loc.id}`)).text();
ok(pagina.includes(pub.nombre) && pagina.includes('intent://pack/' + loc.id), 'la página para compartir tiene el pack y el botón que abre la app');

// ---------- denunciar y bloquear ----------
await B.E((id) => window.__sz.C.abrirPublico(id), loc.id); await B.p.waitForSelector('#puCont .puGrilla .st img');
await B.p.click('#puMenu'); await B.p.click('#modal [data-x="reportar"]'); await B.foto('denunciar'); await B.p.click('#modal [data-m="ofensivo"]');
await B.p.waitForFunction(() => /revisar/.test(document.querySelector('#aviso').textContent));
ok(true, 'denunciar: «Gracias. Lo vamos a revisar»');
await B.p.click('#puMenu'); await B.p.click('#modal [data-x="bloquear"]'); await B.p.click('#modal [data-x="1"]');
await B.p.waitForFunction(() => /Bloqueaste/.test(document.querySelector('#aviso').textContent));
await B.p.click('#tabs [data-t="Feed"]'); await B.p.click('#feedSeg [data-m="para-vos"]'); await B.p.waitForFunction(() => !document.querySelector('#feedLista .esq'), null, { timeout: 10000 }); await espera(300);
ok((await B.p.locator('#feedLista .tf:not(.esq)').count()) === 0, 'bloquear a @juancito: su pack no aparece más en el feed');

// ---------- @juancito: sus números, editar perfil, borrar la cuenta ----------
await A.p.click('#vPack .volver'); await A.p.click('#tabs [data-t="Perfil"]'); await A.p.waitForSelector('#tabPerfil .stats');
const st = await A.E(() => [...document.querySelectorAll('#tabPerfil .stats b')].map((b) => b.textContent));
ok(st.join(',') === '1,0,1,1', `perfil de @juancito: packs ${st[0]}, seguidores ${st[1]} (lo bloquearon: se fue), descargas ${st[2]}, me gusta ${st[3]}`);
await A.p.click('#tabPerfil [data-editar]'); await A.p.click('#epE [data-v="🧉"]'); await A.p.click('#epC [data-v="#74acdf"]'); await A.p.fill('#epBio', 'Stickers del grupo, con mate 🧉'); await A.foto('editar_perfil');
await A.p.click('#modal [data-x="1"]'); await A.p.waitForFunction(() => /🧉/.test(document.querySelector('#tabPerfil .avG').textContent));
ok((await srvApi('/api/usuarios/juancito')).usuario.avatar.e === '🧉' && /con mate/.test(await A.p.textContent('#tabPerfil .bio')), 'editar perfil: avatar 🧉 celeste y bio'); await A.foto('perfil_editado');
await A.p.click('#tabPerfil [data-x="borrar"]'); await A.p.click('#modal [data-x="1"]'); await A.p.waitForSelector('#regNombre');
ok((await fetch(`${API}/api/packs/${loc.id}`)).status === 404 && !(await A.E(() => window.__sz.E.packs.some((p) => p.publicado))) && !(await A.E(() => localStorage.sz_cuenta)), 'borrar la cuenta: se va del servidor, el pack queda en el celular sin «publicado», y vuelve la bienvenida');

// ---------- sin conexión ----------
const D = await celular('D', 'http://127.0.0.1:9');
await D.p.waitForSelector('#feedLista .vacio'); await D.p.waitForFunction(() => document.querySelectorAll('#feedListos img[src^="data:"]').length >= 4, null, { timeout: 15000 });
ok(/Sin conexión/.test(await D.p.textContent('#feedLista')), 'sin conexión: lo dice, y mientras tanto muestra los packs listos'); await D.foto('sin_conexion');
await D.p.click('#tabs [data-t="Crear"]'); ok(await D.p.isVisible('#bCrear'), 'sin conexión se puede crear igual');

console.log('errores de las páginas:', JSON.stringify(errores.filter((e) => !/127\.0\.0\.1:9\//.test(e) && !/\/packs\/[a-z0-9]{10}$/.test(e))));
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`);
await b.close(); web.close(); srv.close(); process.exit(fallas ? 1 : 0);
