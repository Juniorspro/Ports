// La zona social y el chat, contra el servidor de verdad (sobre SQLite): publicar con imagen, sticker y «video» (sticker
// animado), me gusta, palabras prohibidas, imágenes muy pesadas, amigos (pedir y aceptar), chat sólo entre amigos (texto,
// pegatinas, un sticker propio), denuncias que ocultan, bloquear (corta la amistad y el chat), moderación y borrar la
// cuenta. uso: node red.mjs   (las imágenes de prueba: /tmp/claude-0/sz_red/*.webp, las arma Python con PIL)
import fs from 'fs';
const { arrancar } = await import('./servidor_local.mjs');
const PUERTO = 8969, B = `http://127.0.0.1:${PUERTO}`, D = '/tmp/claude-0/sz_red/';
const { env } = await arrancar(PUERTO);
let bien = 0, fallas = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 200) : '')); c ? bien++ : fallas++; };
const api = async (ruta, o = {}, tok) => { const h = {}; if (tok) h.Authorization = 'Bearer ' + tok; if (o.json) h['Content-Type'] = 'application/json'; if (o.admin) h['X-Admin'] = 'clave-admin'; const r = await fetch(B + ruta, { method: o.method || 'GET', headers: h, body: o.json ? JSON.stringify(o.json) : undefined }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch (e) { /* nada */ } return { st: r.status, j, h: r.headers }; };
const cuenta = async (n) => { await env.DB.prepare('DELETE FROM limites').run(); const r = await api('/api/registro', { method: 'POST', json: { nombre: n } }); return { tok: r.j.token, id: r.j.usuario.id, nombre: n }; };
const b64 = (f) => fs.readFileSync(D + f).toString('base64');
await api('/api/config');   // (la primera consulta arma las tablas)
const A = await cuenta('ana.publica'), Bq = await cuenta('beto.amigo'), C = await cuenta('caro.otra'), Dd = await cuenta('dani.cuarto');
// ---- publicar ----
const p1 = await api('/api/social/posts', { method: 'POST', json: { texto: 'Mi primer sticker!', media: [{ tipo: 'img', datos: b64('img.webp') }, { tipo: 'st', datos: b64('st.webp') }, { tipo: 'anim', datos: b64('anim.webp') }] } }, A.tok);
ok(p1.st === 201 && p1.j.post.media.length === 3 && p1.j.post.autor.nombre === 'ana.publica', 'publicar: texto, una imagen, un sticker y un «video» (sticker animado)', p1.j && p1.j.post && p1.j.post.media);
const img = await fetch(`${B}/${p1.j.post.media[0].url}`); ok(img.status === 200 && img.headers.get('content-type') === 'image/webp', 'la imagen de la publicación se ve');
ok((await api('/api/social/posts', { method: 'POST', json: { texto: 'fotos porno aca' } }, Bq.tok)).st === 400, 'con una palabra prohibida no se publica');
ok((await api('/api/social/posts', { method: 'POST', json: { texto: '' } }, Bq.tok)).st === 400, 'vacía no se publica');
const gr = await api('/api/social/posts', { method: 'POST', json: { media: [{ tipo: 'img', datos: b64('grande.webp') }] } }, Bq.tok); ok(gr.st === 400, 'una imagen demasiado pesada o grande no se publica', gr.j);
ok((await api('/api/social/posts', { method: 'POST', json: { texto: 'hola' } })).st === 401, 'sin cuenta no se publica');
const p2 = await api('/api/social/posts', { method: 'POST', json: { texto: 'Hola soy Beto' } }, Bq.tok);
const f1 = await api('/api/social/feed', {}, C.tok); ok(f1.st === 200 && f1.j.posts.length === 2 && f1.j.posts[0].id === p2.j.post.id, 'el feed: las dos, la más nueva arriba');
// ---- me gusta ----
const l1 = await api(`/api/social/posts/${p1.j.post.id}/like`, { method: 'POST' }, Bq.tok), l2 = await api(`/api/social/posts/${p1.j.post.id}/like`, { method: 'POST' }, C.tok), l3 = await api(`/api/social/posts/${p1.j.post.id}/like`, { method: 'POST' }, Bq.tok);
ok(l1.j.yoLike && l2.j.likes === 2 && !l3.j.yoLike && l3.j.likes === 1, 'me gusta: se da y se saca', [l1.j, l2.j, l3.j]);
const f2 = await api('/api/social/feed', {}, C.tok); ok(f2.j.posts.find((x) => x.id === p1.j.post.id).yoLike === true, 'el feed sabe a cuáles les di me gusta');
// ---- amigos ----
const s1 = await api(`/api/amigos/${A.id}`, { method: 'POST' }, Bq.tok); ok(s1.j.estado === 'enviado', 'Beto le pide amistad a Ana');
const am1 = await api('/api/amigos', {}, A.tok); ok(am1.j.pedidos.length === 1 && am1.j.pedidos[0].nombre === 'beto.amigo' && !am1.j.amigos.length, 'Ana ve el pedido');
const nov = await api('/api/chat/novedades', {}, A.tok); ok(nov.j.pedidos === 1, 'y le figura en las novedades');
ok((await api(`/api/chat/${Bq.id}`, { method: 'POST', json: { texto: 'hola' } }, A.tok)).st === 403, 'sin aceptar, no se pueden escribir');
const s2 = await api(`/api/amigos/${Bq.id}`, { method: 'POST' }, A.tok); ok(s2.j.estado === 'amigos', 'Ana acepta: amigos');
// ---- chat ----
const m1 = await api(`/api/chat/${Bq.id}`, { method: 'POST', json: { texto: '¡Hola Beto!' } }, A.tok);
const m2 = await api(`/api/chat/${A.id}`, { method: 'POST', json: { st: { tipo: 'pega', id: 'risa' } } }, Bq.tok);
const m3 = await api(`/api/chat/${A.id}`, { method: 'POST', json: { st: { tipo: 'mio', datos: b64('st.webp') } } }, Bq.tok);
ok(m1.st === 201 && m2.st === 201 && m3.st === 201 && /^c\/[a-z0-9]{10}\/st\.webp$/.test(m3.j.mensaje.st.url), 'chat: texto, una pegatina y un sticker propio (con dirección al azar)', m3.j && m3.j.mensaje);
ok((await fetch(`${B}/${m3.j.mensaje.st.url}`)).status === 200, 'el sticker propio del chat se ve');
ok((await api(`/api/chat/${A.id}`, { method: 'POST', json: { texto: 'mandame nudes' } }, Bq.tok)).st === 400, 'mensajes con palabras prohibidas no salen');
const n2 = await api('/api/chat/novedades', {}, A.tok); ok(n2.j.mensajes === 2, 'Ana tiene 2 mensajes sin leer', n2.j);
const lista = await api('/api/chat', {}, A.tok); ok(lista.j.chats.length === 1 && lista.j.chats[0].sinLeer === 2 && lista.j.chats[0].ultimo.st, 'la lista de chats: Beto, con 2 sin leer y el último es un sticker', lista.j.chats[0]);
const conv = await api(`/api/chat/${Bq.id}`, {}, A.tok); ok(conv.j.mensajes.length === 3 && conv.j.mensajes[0].mio && conv.j.mensajes[1].st.tipo === 'pega', 'la conversación en orden', conv.j.mensajes.map((x) => x.texto || x.st.tipo));
ok((await api('/api/chat/novedades', {}, A.tok)).j.mensajes === 0, 'al abrirla quedan leídos');
const nuevos = await api(`/api/chat/${Bq.id}?desde=${conv.j.mensajes[2].id}`, {}, A.tok); ok(nuevos.j.mensajes.length === 0, 'pedir sólo lo nuevo (desde el último)');
ok((await api(`/api/chat/${A.id}`, { method: 'POST', json: { texto: 'hola desconocida' } }, C.tok)).st === 403, 'alguien que no es amigo no le puede escribir');
const rep = await api(`/api/chat/mensaje/${m2.j.mensaje.id}/reportar`, { method: 'POST', json: { motivo: 'acoso' } }, A.tok); ok(rep.st === 200, 'un mensaje se puede denunciar');
// ---- denuncias: con 3, la publicación se oculta ----
for (const u of [Bq, C, Dd]) await api(`/api/social/posts/${p1.j.post.id}/reportar`, { method: 'POST', json: { motivo: 'ofensivo' } }, u.tok);
const f3 = await api('/api/social/feed', {}, Dd.tok); ok(!f3.j.posts.some((x) => x.id === p1.j.post.id), 'con 3 denuncias se oculta del feed');
ok((await fetch(`${B}/${p1.j.post.media[0].url}`)).status === 404, 'y sus imágenes dejan de verse');
const adm = await api('/api/admin/social', { admin: true }); ok(adm.st === 200 && adm.j.posts.some((x) => x.id === p1.j.post.id && x.oculto) && adm.j.mensajes.some((x) => x.id === m2.j.mensaje.id), 'la moderación ve la publicación y el mensaje denunciados');
ok((await api('/api/admin/social')).st === 403, 'sin la clave, no');
await api('/api/admin/social', { method: 'POST', admin: true, json: { post: p1.j.post.id, accion: 'mostrar' } });
ok((await api('/api/social/feed', {}, Dd.tok)).j.posts.some((x) => x.id === p1.j.post.id), 'la moderación la vuelve a mostrar');
// ---- bloquear corta la amistad y el chat ----
await api(`/api/usuarios/${Bq.id}/bloquear`, { method: 'POST' }, A.tok);
ok((await api('/api/amigos', {}, A.tok)).j.amigos.length === 0 && (await api(`/api/chat/${A.id}`, { method: 'POST', json: { texto: '¿?' } }, Bq.tok)).st === 403, 'bloquear: ya no son amigos y no se pueden escribir');
ok(!(await api('/api/social/feed', {}, A.tok)).j.posts.some((x) => x.autor.id === Bq.id), 'y no ve sus publicaciones');
ok((await api(`/api/amigos/${A.id}`, { method: 'POST' }, Bq.tok)).st === 403, 'ni le puede volver a pedir amistad');
// ---- amigos: el feed «amigos» ----
await api(`/api/amigos/${C.id}`, { method: 'POST' }, Dd.tok); await api(`/api/amigos/${Dd.id}`, { method: 'POST' }, C.tok);
await api('/api/social/posts', { method: 'POST', json: { texto: 'post de caro' } }, C.tok);
const fa = await api('/api/social/feed?modo=amigos', {}, Dd.tok); ok(fa.j.posts.length === 1 && fa.j.posts[0].autor.nombre === 'caro.otra', 'el feed de amigos: sólo lo de sus amigos', fa.j.posts.map((x) => x.autor.nombre));
// ---- borrar la cuenta ----
const borrar = await api('/api/yo', { method: 'DELETE' }, A.tok);
const f4 = await api('/api/social/feed', {}, Dd.tok); ok(borrar.st === 200 && !f4.j.posts.some((x) => x.autor.nombre === 'ana.publica') && (await fetch(`${B}/${m3.j.mensaje.st.url}`)).status === 404, 'borrar la cuenta: se van sus publicaciones, sus mensajes y sus stickers del chat');
ok((await env.DB.prepare('SELECT COUNT(*) AS n FROM mensajes').first()).n === 0, 'no quedan mensajes de esa cuenta');
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`); process.exit(fallas ? 1 : 0);
