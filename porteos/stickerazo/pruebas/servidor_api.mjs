// El servidor de la comunidad, punta a punta (el Worker de verdad sobre SQLite): cuentas, publicar (y lo que no se
// puede publicar), feed, me gusta, seguir, descargas, buscar, tendencias, denuncias (3 → se oculta), bloquear,
// actualizar, moderación, borrar la cuenta, CORS y las páginas. Usa los archivos de /tmp/claude-0/sz_fix (Pillow).
import fs from 'fs'; import crypto from 'crypto'; import { arrancar } from './servidor_local.mjs';
const FIX = '/tmp/claude-0/sz_fix/', PUERTO = 8991, B = `http://127.0.0.1:${PUERTO}${process.env.SZ_BASE || ''}`;
const { srv, env: ENV } = await arrancar(PUERTO, 'clave-admin', { SZ_EVENTO_META: '5' });   // (el evento del termo, con 5 cuentas en vez de 20)
let fallas = 0, bien = 0; const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); c ? bien++ : fallas++; };
const api = async (ruta, o = {}, tok) => { const h = { ...(o.headers || {}) }; if (tok) h.Authorization = 'Bearer ' + tok; if (o.json) { h['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.json); } const r = await fetch(B + ruta, { ...o, headers: h }); let j = null; try { j = await r.clone().json(); } catch (e) {} return { st: r.status, j, r }; };
const archivo = (n, como) => new File([fs.readFileSync(FIX + n)], como || n);
function formPack(meta, archivos) { const f = new FormData(); f.set('meta', JSON.stringify(meta)); for (const [como, n] of archivos) f.set(como, archivo(n, como)); return f; }
const quietos = { nombre: 'Mis primeros 🧉', tags: ['#Mate', 'jaja', 'Fútbol'], textos: 'un mate y arranco', animado: false, bandeja: 'bandeja.png', stickers: [{ archivo: 's1.webp', emojis: ['🧉'] }, { archivo: 's2.webp', emojis: ['😂', '🔥'] }, { archivo: 's3.webp', emojis: [] }] };
const archQ = [['s1.webp', 'q1.webp'], ['s2.webp', 'q2.webp'], ['s3.webp', 'q3.webp'], ['bandeja.png', 'bandeja.png']];

// ---- cuentas ----
for (const n of ['ab', 'Admin', 'puto123', 'stickerazo_oficial', 'nazi.ok', '.punto', 'con espacio']) { const r = await api('/api/registro', { method: 'POST', json: { nombre: n } }); if (r.st !== 400) ok(false, `nombre «${n}» rechazado (dio ${r.st})`); }
ok(true, 'nombres rechazados: corto, mayúsculas que dan «admin», insulto, reservado, odio, punto al principio, espacio');
const ra = await api('/api/registro', { method: 'POST', json: { nombre: '@JuanCito' } }), A = ra.j && ra.j.token, idA = ra.j && ra.j.usuario.id;
ok(ra.st === 201 && A && ra.j.usuario.nombre === 'juancito' && ra.j.usuario.avatar.e, `registro: @${ra.j && ra.j.usuario.nombre} con avatar ${ra.j && ra.j.usuario.avatar.e}`);
ok((await api('/api/registro', { method: 'POST', json: { nombre: 'juancito' } })).st === 409, 'el mismo @ dos veces: no');
const rb = await api('/api/registro', { method: 'POST', json: { nombre: 'maria.sol' } }), Bt = rb.j.token, idB = rb.j.usuario.id;
const rc = await api('/api/registro', { method: 'POST', json: { nombre: 'el_tano' } }), C = rc.j.token, idC = rc.j.usuario.id;
ok((await api('/api/yo', {}, A)).j.usuario.nombre === 'juancito' && (await api('/api/yo', {}, A.replace(/.$/, 'x'))).st === 401, 'con la llave entra; con una llave cambiada, no');
const pt = await api('/api/yo', { method: 'PATCH', json: { bio: 'Hago stickers del grupo 🧉', avatar: { e: '🤠', c: '#3ec7ff' } } }, A);
ok(pt.j.usuario.bio === 'Hago stickers del grupo 🧉' && pt.j.usuario.avatar.e === '🤠', 'editar bio y avatar');
ok((await api('/api/yo', { method: 'PATCH', json: { bio: 'mirá mis n u d e s' } }, A)).st === 400 && (await api('/api/yo', { method: 'PATCH', json: { bio: 'p0rn0 gratis' } }, A)).st === 400, 'bio con palabras prohibidas (aunque estén separadas o con números): no');
ok((await api('/api/yo', { method: 'PATCH', json: { bio: 'Yo controlo el asado. Saludos de Nazir y del Tano' } }, A)).st === 200, 'sin falsos positivos: «controlo», «Nazir»');
await api('/api/yo', { method: 'PATCH', json: { bio: 'Hago stickers del grupo 🧉' } }, A);

// ---- publicar ----
ok((await api('/api/packs', { method: 'POST', body: formPack(quietos, archQ) })).st === 401, 'publicar sin cuenta: no');
const malos = [
  [{ ...quietos, stickers: quietos.stickers.slice(0, 2) }, archQ, 'de 3 a 30'], [quietos, [['s1.webp', 'chico.webp'], ...archQ.slice(1)], '512'],
  [quietos, [['s1.webp', 'a1.webp'], ...archQ.slice(1)], 'quietos'], [quietos, archQ.slice(0, 3), 'ícono'], [{ ...quietos, nombre: 'pack porno' }, archQ, 'palabras'],
  [{ ...quietos, stickers: [...quietos.stickers.slice(0, 2), { archivo: '../x.webp' }] }, archQ, 'raro'],
];
for (const [meta, arch, que] of malos) { const r = await api('/api/packs', { method: 'POST', body: formPack(meta, arch) }, A); ok(r.st === 400 && r.j.error, `no se publica (${que}): «${r.j && r.j.error}»`); }
const p1 = await api('/api/packs', { method: 'POST', body: formPack(quietos, archQ) }, A), id1 = p1.j.pack.id;
ok(p1.st === 201 && p1.j.pack.n === 3 && p1.j.pack.tags.join(',') === 'mate,jaja,futbol' && p1.j.pack.autor.nombre === 'juancito', `publicado «${p1.j.pack.nombre}» (${id1}), etiquetas ${p1.j.pack.tags.join(' ')}`);
const animado = { ...quietos, nombre: 'Animados del grupo', tags: ['jaja'], animado: true };
const p2 = await api('/api/packs', { method: 'POST', body: formPack(animado, [['s1.webp', 'a1.webp'], ['s2.webp', 'a2.webp'], ['s3.webp', 'a3.webp'], ['bandeja.png', 'bandeja.png']]) }, A), id2 = p2.j.pack.id;
ok(p2.st === 201 && p2.j.pack.animado, 'pack animado publicado (todos animados)');
const p3 = await api('/api/packs', { method: 'POST', body: formPack({ ...quietos, nombre: 'Los del Tano', tags: ['asado'], textos: 'que asadito' }, archQ) }, C), id3 = p3.j.pack.id;

// ---- ver: el pack, los archivos, la página para compartir ----
const d1 = await api('/api/packs/' + id1);
ok(d1.j.pack.stickers.length === 3 && d1.j.pack.stickers[2].emojis[0] === '😂', 'el pack, con sus stickers (sin emojis → 😂)');
const mr = await fetch(`${B}/m/${id1}/s1.webp?v=1`), mb = new Uint8Array(await mr.arrayBuffer());
ok(mr.status === 200 && mr.headers.get('content-type') === 'image/webp' && Buffer.compare(Buffer.from(mb), fs.readFileSync(FIX + 'q1.webp')) === 0 && mr.headers.get('access-control-allow-origin') === '*', `el sticker se baja igual que se subió (${mb.length} bytes, image/webp, CORS)`);
ok((await fetch(`${B}/m/${id1}/..%2Fx.webp`)).status === 404 && (await fetch(`${B}/m/${id1}/nada.webp`)).status === 404, 'archivos raros o que no están: 404');
const pg = await (await fetch(`${B}/p/${id1}`)).text();
ok(/og:image/.test(pg) && pg.includes(`intent://pack/${id1}#Intent;scheme=stickerazo;package=com.stickerazo.app`) && pg.includes('@juancito'), 'la página para compartir: vista previa (og), botón que abre la app, autor');

// ---- feed, me gusta, seguir, descargas ----
const fn = await api('/api/feed?modo=nuevos', {}, Bt);
ok(fn.j.packs.length === 3 && fn.j.packs[0].id === id3, `feed «Nuevos»: ${fn.j.packs.length} packs, el más nuevo primero`);
const l1 = await api(`/api/packs/${id1}/like`, { method: 'POST' }, Bt), l2 = await api(`/api/packs/${id1}/like`, { method: 'POST' }, Bt);
ok(l1.j.likes === 1 && l2.j.likes === 1, 'me gusta: 1 (dos veces el mismo no suma)');
await api(`/api/packs/${id1}/like`, { method: 'POST' }, C);
ok((await api(`/api/packs/${id1}/like`, { method: 'DELETE' }, C)).j.likes === 1, 'sacar el me gusta: vuelve a 1');
await api(`/api/packs/${id2}/descarga`, { method: 'POST' }, Bt); await api(`/api/packs/${id2}/descarga`, { method: 'POST' }, Bt); await api(`/api/packs/${id2}/descarga`, { method: 'POST' }, C);
const fv = await api('/api/feed?modo=para-vos', {}, Bt);
ok(fv.j.packs.map((p) => p.id).indexOf(id1) < fv.j.packs.map((p) => p.id).indexOf(id3) && fv.j.packs.find((p) => p.id === id1).yaLike === true && fv.j.packs.find((p) => p.id === id2).descargas === 2,
  `feed «Para vos»: el que gusta va antes que el más nuevo; marca tu me gusta; descargas 2 (repetida no cuenta)`);
ok((await api('/api/feed?modo=siguiendo')).j.necesitaCuenta && (await api('/api/feed?modo=siguiendo', {}, Bt)).j.packs.length === 0, '«Siguiendo»: sin cuenta pide entrar; sin seguir a nadie, vacío');
const sg = await api(`/api/usuarios/${idA}/seguir`, { method: 'POST' }, Bt);
ok(sg.j.sigo && sg.j.seguidores === 1 && (await api('/api/feed?modo=siguiendo', {}, Bt)).j.packs.length === 2, 'seguir a @juancito: 1 seguidor; en «Siguiendo» aparecen sus 2 packs');
ok((await api(`/api/usuarios/${idB}/seguir`, { method: 'POST' }, Bt)).st === 400, 'seguirse a uno mismo: no');
const pf = await api('/api/usuarios/juancito', {}, Bt);
ok(pf.j.usuario.packs === 2 && pf.j.usuario.likes === 1 && pf.j.usuario.descargas === 2 && pf.j.sigo && pf.j.packs.length === 2, `perfil: ${pf.j.usuario.packs} packs, ${pf.j.usuario.likes} me gusta, ${pf.j.usuario.descargas} descargas, lo sigo`);

// ---- buscar y tendencias ----
const bq = async (q) => (await api('/api/buscar?q=' + encodeURIComponent(q), {}, Bt)).j;
ok((await bq('MATE')).packs.some((p) => p.id === id1) && (await bq('#asado')).packs[0].id === id3 && (await bq('futbol')).packs.length >= 1 && (await bq('🔥')).packs.length >= 1,
  'buscar: «MATE» (texto), «#asado» (etiqueta), «futbol» (sin tilde), «🔥» (emoji)');
ok((await bq('@juan')).usuarios[0].nombre === 'juancito' && (await bq('nada que ver')).packs.length === 0, 'buscar gente por @; lo que no está, vacío');
const td = (await api('/api/tendencias')).j.tags;
ok(td[0] === 'jaja' && td.includes('mate'), `tendencias: ${td.join(' ')}`);

// ---- actualizar ----
const up = await api('/api/packs/' + id1, { method: 'PUT', body: formPack({ ...quietos, nombre: 'Mis primeros (v2)' }, archQ) }, A);
ok(up.st === 200 && up.j.pack.v === 2 && up.j.pack.nombre === 'Mis primeros (v2)' && up.j.pack.likes === 1, 'actualizar: versión 2, mismo id, los me gusta quedan');
ok((await api('/api/packs/' + id1, { method: 'PUT', body: formPack(quietos, archQ) }, Bt)).st === 403, 'actualizar un pack ajeno: no');

// ---- ocultar un pack mío (sin borrarlo) ----
{
  const pv = await api(`/api/packs/${id1}/privado`, { method: 'POST', json: { privado: true } }, A);
  const enNuevos = (await api('/api/feed?modo=nuevos')).j.packs.some((p) => p.id === id1);
  const paraOtros = (await api('/api/usuarios/juancito')).j.packs.some((p) => p.id === id1), paraMi = (await api('/api/usuarios/juancito', {}, A)).j.packs.find((p) => p.id === id1);
  const abrirOtro = (await api('/api/packs/' + id1, {}, Bt)).st, abrirYo = (await api('/api/packs/' + id1, {}, A)).j;
  ok(abrirOtro === 404 && abrirYo.pack && abrirYo.pack.privado && abrirYo.pack.esMio, 'un pack oculto: otro no lo puede abrir; su dueño sí (y sabe que está oculto)');
  ok(pv.st === 200 && !enNuevos && !paraOtros && paraMi && paraMi.privado && (await api(`/api/packs/${id1}/privado`, { method: 'POST', json: { privado: true } }, Bt)).st === 403,
    'ocultar un pack mío: sale del feed y de mi perfil para los demás, yo lo sigo viendo (marcado); otro no lo puede ocultar');
  await api(`/api/packs/${id1}/privado`, { method: 'POST', json: { privado: false } }, A);
  ok((await api('/api/feed?modo=nuevos')).j.packs.some((p) => p.id === id1), 'mostrarlo otra vez: vuelve al feed');
}
// ---- el evento del termo (acá la meta es 5 cuentas) ----
{
  const e0 = (await api('/api/evento')).j;
  ok(e0.meta === 5 && e0.cuentas >= 1 && e0.cuentas < 5 && !e0.sorteado && !e0.elegidos.length, `evento: ${e0.cuentas} de ${e0.meta} cuentas con stickers, todavía sin sorteo`);
  const nuevas = [];
  for (let k = 0; k < 5; k++) {
    const r = await api('/api/registro', { method: 'POST', json: { nombre: 'termo' + k }, headers: { 'CF-Connecting-IP': '10.0.0.' + k } });
    await api('/api/packs', { method: 'POST', body: formPack({ ...quietos, nombre: 'Pack del termo ' + k }, archQ) }, r.j.token); nuevas.push(r.j);
  }
  const e1 = (await api('/api/evento')).j, e2 = (await api('/api/evento')).j;
  ok(e1.sorteado && e1.elegidos.length === 5 && e1.elegidos.every((x) => x.autor.nombre && x.pack.sticker) && new Set(e1.elegidos.map((x) => x.autor.id)).size === 5,
    `al llegar a ${e1.cuentas} cuentas el termo eligió 5: ${e1.elegidos.map((x) => '@' + x.autor.nombre).join(' ')}`);
  ok(JSON.stringify(e2.elegidos.map((x) => x.autor.id)) === JSON.stringify(e1.elegidos.map((x) => x.autor.id)), 'el sorteo queda fijo (no se vuelve a sortear)');
  const f = (await api('/api/feed')).j.packs, ids = e1.elegidos.map((x) => x.pack.id);
  ok(f.slice(0, 5).every((p) => p.termo && ids.includes(p.id)), 'a los que recién llegan, «Para vos» les muestra primero los 5 del termo');
  const perfilElegido = (await api('/api/usuarios/' + e1.elegidos[0].autor.nombre)).j;
  ok(perfilElegido.usuario.insignias.includes('termo'), `@${e1.elegidos[0].autor.nombre} tiene la insignia del termo en su perfil`);
}
// ---- foto de perfil y portada propias ----
{
  const img = fs.readFileSync(FIX + 'q1.webp');
  const sube = (que, cuerpo, tipo, tok) => fetch(B + '/api/yo/' + que, { method: 'PUT', headers: { 'Content-Type': tipo, ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: cuerpo });
  const f1 = await (await sube('foto', img, 'image/webp', C)).json(), p1 = await (await sube('portada', img, 'image/webp', C)).json();
  const fv = await fetch(B + '/' + f1.usuario.avatar.f), pv = await fetch(B + '/' + p1.usuario.avatar.b);
  ok(/^u\/[a-z0-9]{10}\/foto\?v=\d+$/.test(f1.usuario.avatar.f) && fv.status === 200 && fv.headers.get('content-type') === 'image/webp' && pv.status === 200 && p1.usuario.avatar.f,
    'subir foto de perfil y portada: quedan en el perfil (con su versión) y se ven');
  ok((await sube('foto', img, 'image/webp')).status === 401 && (await sube('foto', Buffer.from('hola, no soy una imagen'), 'image/webp', C)).status === 400 && (await sube('foto', Buffer.alloc(300 * 1024, 1), 'image/webp', C)).status === 400,
    'foto: sin cuenta no; algo que no es imagen, no; muy pesada, no');
  const pt2 = (await api('/api/yo', { method: 'PATCH', json: { avatar: { e: '🧉', c: '#ffd23f', p: 2 } } }, C)).j.usuario.avatar;
  ok(pt2.f && pt2.b && pt2.e === '🧉', 'cambiar el emoji o el color no borra la foto ni la portada');
  const enFeed = (await api('/api/usuarios/el_tano')).j.packs.concat((await api('/api/feed?modo=nuevos')).j.packs).find((p) => p.autor.nombre === 'el_tano');
  ok(!enFeed || enFeed.autor.avatar.f, 'en las tarjetas de sus packs también va su foto');
  const q = (await api('/api/yo', { method: 'PATCH', json: { avatar: { ...pt2, quitarFoto: true } } }, C)).j.usuario.avatar;
  ok(!q.f && q.b && (await fetch(B + '/' + f1.usuario.avatar.f)).status === 404, 'sacar la foto: vuelve el emoji (la portada queda)');
  // tres denuncias al perfil: se le saca la portada (y la foto) sola
  await sube('foto', img, 'image/webp', C);
  const antes = (await api('/api/usuarios/el_tano')).j.usuario.avatar;
  ok(antes.f && antes.b, 'el perfil público (el que ven los demás) trae la foto y la portada');
  const rx = await api('/api/registro', { method: 'POST', json: { nombre: 'vecino.x' }, headers: { 'CF-Connecting-IP': '10.0.0.99' } });
  for (const t of [A, Bt, rx.j.token]) await api(`/api/usuarios/${idC}/reportar`, { method: 'POST', json: { motivo: 'ofensivo' } }, t);
  const tras = (await api('/api/usuarios/el_tano')).j.usuario.avatar;
  ok(!tras.f && !tras.b, 'con 3 denuncias al perfil, la foto y la portada se sacan solas');
}
// ---- bloquear y denunciar ----
await api(`/api/usuarios/${idC}/bloquear`, { method: 'POST' }, Bt);
ok(!(await api('/api/feed?modo=nuevos', {}, Bt)).j.packs.some((p) => p.id === id3) && (await api('/api/feed?modo=nuevos')).j.packs.some((p) => p.id === id3), 'bloquear a @el_tano: no lo veo más (los demás sí)');
const rD = await api('/api/registro', { method: 'POST', json: { nombre: 'pepe_argento' } }), D = rD.j.token;
for (const t of [Bt, C]) await api(`/api/packs/${id2}/reportar`, { method: 'POST', json: { motivo: 'ofensivo' } }, t);
ok((await api('/api/packs/' + id2)).st === 200, 'con 2 denuncias sigue visible');
const rp = await api(`/api/packs/${id2}/reportar`, { method: 'POST', json: { motivo: 'sexual' } }, D);
ok(rp.j.oculto && (await api('/api/packs/' + id2)).st === 404 && (await fetch(`${B}/m/${id2}/s1.webp?v=1`)).status === 404 && !(await api('/api/feed?modo=nuevos')).j.packs.some((p) => p.id === id2), 'con 3 denuncias se oculta: no está en el feed, ni el pack ni sus archivos');

// ---- moderación ----
ok((await api('/api/admin/reportados')).st === 403 && (await api('/api/admin/reportados', { headers: { 'X-Admin': 'otra' } })).st === 403, 'moderación sin la clave: no');
const ad = await api('/api/admin/reportados', { headers: { 'X-Admin': 'clave-admin' } }), rep = ad.j.packs.find((p) => p.id === id2);
ok(rep && rep.oculto && rep.reportes === 3 && rep.motivos.length === 2, `moderación: el pack denunciado (3 denuncias: ${rep && rep.motivos.map((m) => m.motivo + ' ' + m.n).join(', ')})`);
ok((await fetch(`${B}/m/${id2}/s1.webp?v=1`, { headers: { 'X-Admin': 'clave-admin' } })).status === 200, 'la moderación ve las imágenes del oculto');
await api('/api/admin/packs/' + id2, { method: 'POST', json: { accion: 'mostrar' }, headers: { 'X-Admin': 'clave-admin' } });
ok((await api('/api/packs/' + id2)).st === 200, 'moderación «Mostrar»: vuelve a verse');
await api('/api/admin/usuarios/' + idC, { method: 'POST', json: { bloqueado: 1 }, headers: { 'X-Admin': 'clave-admin' } });
ok((await api('/api/yo', {}, C)).st === 401 && (await api('/api/usuarios/el_tano')).st === 404 && !(await api('/api/feed?modo=nuevos')).j.packs.some((p) => p.id === id3), 'cuenta bloqueada por moderación: no entra, no se ve su perfil ni sus packs');

// ---- borrar la cuenta ----
const antes = (await api('/api/usuarios/juancito')).j.usuario.seguidores;
const del = await api('/api/yo', { method: 'DELETE' }, Bt);
ok(del.j.ok && (await api('/api/usuarios/maria.sol')).st === 404 && (await api('/api/usuarios/juancito')).j.usuario.seguidores === antes - 1 && (await api('/api/packs/' + id1)).j.pack.likes === 0,
  'borrar la cuenta de @maria.sol: no existe más, @juancito pierde el seguidor y su pack el me gusta');
const del2 = await api('/api/yo', { method: 'DELETE' }, A);
ok(del2.j.ok && (await api('/api/packs/' + id1)).st === 404 && (await fetch(`${B}/m/${id1}/s1.webp?v=2`)).status === 404, 'borrar la cuenta de @juancito: se van sus packs y sus archivos');

// ---- lo que sale del repo: las actualizaciones (/web/…), la página web (/) y el APK (/app.json, /descargar) ----
{
  const ota = await fetch(B + '/web/ota.json'), local = fs.readFileSync(new URL('../web/ota.json', import.meta.url), 'utf8');
  ok(ota.status === 200 && /application\/json/.test(ota.headers.get('content-type')) && (await ota.text()) === local && ota.headers.get('access-control-allow-origin') === '*',
    'actualizaciones: /web/ota.json es el del repo, para la app (desde cualquier origen)');
  const js = await fetch(B + '/web/app.js'); ok(js.status === 200 && /javascript/.test(js.headers.get('content-type')) && (await js.text()).length > 1000, '…y los archivos de la página (/web/app.js)');
  const st = []; for (const m of ['/web/%2e%2e/servidor/worker.js', '/web/_prueba.js', '/web/.git/config', '/web/terceros/../../servidor/worker.js', '/web/app.exe', '/web/no_existe.js', '/a/../../servidor/worker.js']) st.push((await fetch(B + m)).status);
  ok(st.every((x) => x === 404), `nada de afuera de web/ y sitio/a/, ni ocultos, ni de prueba, ni tipos raros (${st.join(' ')})`);
  const raiz = await fetch(B + '/'), t = await raiz.text();
  ok(raiz.status === 200 && /text\/html/.test(raiz.headers.get('content-type')) && /Stickerazo/.test(t), 'la página web en /');
  if (process.env.SZ_BASE) { const r = await fetch(`http://127.0.0.1:${PUERTO}${process.env.SZ_BASE}`, { redirect: 'manual' }); ok(r.status === 302 && r.headers.get('location').endsWith(process.env.SZ_BASE + '/'), `${process.env.SZ_BASE} lleva a ${process.env.SZ_BASE}/ (así andan las imágenes de la página)`); }
  const desc = new URL('../descargas/', import.meta.url);
  if (fs.existsSync(new URL('app.json', desc))) {
    const info = JSON.parse(fs.readFileSync(new URL('app.json', desc), 'utf8')), aj = await (await fetch(B + '/app.json')).json();
    const d = await fetch(B + '/descargar'), bytes = Buffer.from(await d.arrayBuffer());
    ok(aj.v === info.v && d.status === 200 && d.headers.get('content-type') === 'application/vnd.android.package-archive' && /attachment/.test(d.headers.get('content-disposition')) && bytes.length === info.n && crypto.createHash('sha256').update(bytes).digest('hex') === info.h,
      `el APK de la página: /app.json (${info.nombre}) y /descargar (${(info.n / 1048576).toFixed(1)} MB, la huella coincide)`);
    const firmado = JSON.parse(JSON.parse(local).datos).apk;
    ok(firmado && firmado.h === info.h && firmado.v === info.v, 'ota.json (firmado) trae la huella de ese APK: la app lo revisa antes de instalarlo');
  }
  // si GitHub no contesta: la página cortita y las actualizaciones dicen «después»
  const antes = ENV.SZ_REPO; ENV.SZ_REPO = 'http://127.0.0.1:1/';
  const caida = await fetch(B + '/'), o2 = await fetch(B + '/web/ota.json'); ENV.SZ_REPO = antes;
  ok(caida.status === 200 && /descargar/.test(await caida.text()) && o2.status === 502, 'sin GitHub: igual hay una página con el botón para bajar, y la app reintenta las actualizaciones más tarde');
}
// ---- CORS y páginas ----
const op = await fetch(B + '/api/feed', { method: 'OPTIONS' });
ok(op.status === 204 && /Authorization/.test(op.headers.get('access-control-allow-headers')), 'CORS: la app (otro origen) puede llamar con su llave');
for (const p of ['/privacidad', '/terminos', '/borrar-cuenta', '/admin']) { const r = await fetch(B + p); if (r.status !== 200) ok(false, p + ' ' + r.status); }
ok(/no salen de tu celular/.test(await (await fetch(B + '/privacidad')).text()), 'páginas: privacidad, términos, borrar cuenta y moderación');
// adentro del Worker de JXMod: todas las tablas con «sz_» (no se toca ninguna de JXMod)
if (process.env.SZ_BASE) { const t = (await ENV.DB.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'").all()).results.map((x) => x.name); ok(t.length >= 9 && t.every((n) => n.startsWith('sz_')), `con SZ_BASE=${process.env.SZ_BASE}: ${t.length} tablas e índices, todos «sz_» (${t.slice(0, 4).join(', ')}…)`); }
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`); srv.close(); process.exit(fallas ? 1 : 0);
